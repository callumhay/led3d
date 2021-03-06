#include <string>

#include "MasterClient.h"
#include "VoxelModel.h"

#define TIME_BETWEEN_DISCOVERY_PACKETS_MICROSECS 1000000

MasterClient:: MasterClient(VoxelModel& voxelModel, led3d::LED3DPacketSerial& slaveSerial) :
  voxelModel(voxelModel),
  slavePacketWriter(slaveSerial),
  packetReader(voxelModel, slavePacketWriter),
  state(DISCOVERING),
  discoveryIP(MULTICAST_DISCOVERY_ADDR0, MULTICAST_DISCOVERY_ADDR1, MULTICAST_DISCOVERY_ADDR2, MULTICAST_DISCOVERY_ADDR3),
  dataIP(MULTICAST_DATA_ADDR0, MULTICAST_DATA_ADDR1, MULTICAST_DATA_ADDR2, MULTICAST_DATA_ADDR3),
  discoveryPacketTimerMicroSecs(TIME_BETWEEN_DISCOVERY_PACKETS_MICROSECS) {
}

MasterClient::~MasterClient() {
}

void MasterClient::begin() {
  this->state = DISCOVERING;

  //this->udp.begin(UDP_DISCOVERY_PORT);
  //this->udp.joinMulticast(this->discoveryIP);

  this->udp.begin(UDP_DATA_PORT);
  this->udp.joinMulticast(this->dataIP);
}

void MasterClient::run(unsigned long dtMicroSecs) {
  
  if (!this->packetReader.readUDP(this->udp, this->voxelModel, dtMicroSecs)) {
    Serial.print("Error while reading UDP packet.");
  }

  /*
  switch (this->state) {
    case MasterClient::DISCOVERING:
      this->discoveryPacketTimerMicroSecs += dtMicroSecs;
      this->sendDiscoveryPacket(dtMicroSecs);
      this->receiveDiscoveryAck();
      break;

    case MasterClient::CONNECTING:
      this->initiateConnectionWithServer();
      break;

    case MasterClient::CONNECTED:
      this->receiveServerPacket(dtMicroSecs);
      this->sendSlavePackets(dtMicroSecs);
      break;

    default:
      this->state = MasterClient::DISCOVERING;
      break;
  }
  */
}

void MasterClient::setState(const StateType& nextState) {
  switch (nextState) {
    case MasterClient::DISCOVERING:
      Serial.println("CLIENT STATE: Entering DISCOVERING state.");
      this->discoveryPacketTimerMicroSecs = 0;
      if (this->tcp.connected()) {
        this->tcp.stop();
      }
      break;

    case MasterClient::CONNECTING:
      Serial.println("CLIENT STATE: Entering CONNECTING state.");
      /*
      this->udp.leaveMulticast(this->discoveryIP);
      this->udp.stop();
      this->udp.begin(UDP_DATA_PORT);
      this->udp.joinMulticast(this->dataIP);
      */
      break;

    case MasterClient::CONNECTED:
      Serial.println("CLIENT STATE: Entering CONNECTED state.");
      this->packetReader.reset(this->voxelModel);
      break;

    default:
      this->state = MasterClient::DISCOVERING;
      return;
  }

  this->state = nextState;
}

void MasterClient::sendDiscoveryPacket(unsigned long dtMicroSecs) {
  if (this->discoveryPacketTimerMicroSecs >= TIME_BETWEEN_DISCOVERY_PACKETS_MICROSECS) {

    Serial.println("Sending discovery packet.");
    this->udp.beginPacket(this->discoveryIP, UDP_DISCOVERY_PORT);
    this->udp.write(DISCOVERY_REQ);
    this->udp.endPacket();

    this->discoveryPacketTimerMicroSecs = 0;
  }
}

void MasterClient::receiveDiscoveryAck() {
  if (this->state != MasterClient::DISCOVERING) {
    return;
  }

  if (this->udp.parsePacket() >= DISCOVERY_ACK_PACKET_MIN_SIZE) {
    Serial.println("UDP Packet received...");

    std::vector<char> tempBuffer;
    tempBuffer.push_back(this->udp.read());
    tempBuffer.push_back(this->udp.read());
    tempBuffer.push_back(this->udp.read());

    std::string tempStr(tempBuffer.begin(), tempBuffer.end());

    Serial.print("Found packet header: ");
    Serial.println(tempStr.c_str());

    if (tempStr == DISCOVERY_ACK) {
      Serial.println("Discovery acknowlegment packet found, reading packet info.");

      // Go through the discovery ack packet and figure out if the ack is for this device
      uint8_t addressParts[4];
      uint16_t readPort;
      if (this->udp.available() && this->udp.read() == ' ') {

        // Read the address
        for (int i = 0; i < 4; i++) {
          MasterClient::readUntil(this->udp, tempBuffer, ' ');
          if (!tempBuffer.empty()) {
            tempStr = std::string(tempBuffer.begin(), tempBuffer.end());
            addressParts[i] = static_cast<uint8_t>(std::atoi(tempStr.c_str()));
          }
          else {
            Serial.println("Poorly formed address in discovery ACK packet.");
            return;
          }
        }

        // Now read the port
        MasterClient::readUntil(this->udp, tempBuffer, ' ');
        if (!tempBuffer.empty()) {
          tempStr = std::string(tempBuffer.begin(), tempBuffer.end());
          readPort = static_cast<uint16_t>(std::atoi(tempStr.c_str()));
        }
        else {
          Serial.println("Poorly formed port in discovery ACK packet.");
          return;
        }

        // We have the address and the port, make sure it's the same as ours
        IPAddress readAddress(addressParts);
        if ((readAddress == WiFi.localIP() || readAddress == Ethernet.localIP()) && readPort == UDP_DISCOVERY_PORT) {

          MasterClient::readUntil(this->udp, tempBuffer, ';');
          if (!tempBuffer.empty()) {
            tempStr = std::string(tempBuffer.begin(), tempBuffer.end());
            readPort = static_cast<uint16_t>(std::atoi(tempStr.c_str()));
          }
          else {
            Serial.println("Poorly formed server port in discovery ACK packet.");
            return;
          }

          // Discovery was a success!
          this->serverAddr = this->udp.remoteIP();
          this->serverPort = readPort;
          this->setState(MasterClient::CONNECTING);

          Serial.print("Discovered - Server IP: ");
          Serial.print(this->serverAddr.toString());
          Serial.print(", port: ");
          Serial.println(this->serverPort);
        }
        else {
          Serial.println("Discovery packet address/port mismatch.");
        }
      }
      else {
        // Malformed packet
        Serial.println("Poorly formed discovery ACK packet.");
      }
    }
    else {
      Serial.println("Discovery packet did not have ACK header.");
    }
  }
  else {
    Serial.println("Waiting to be discovered...");
    delay(1000);
  }
}

void MasterClient::initiateConnectionWithServer() {
  if (this->state != MasterClient::CONNECTING) {
    return;
  }

  uint8_t serverAddrBytes[4];
  for (int i = 0; i < 4; i++) {
    serverAddrBytes[i] = this->serverAddr[i];
  }

  Serial.println("Attempting TCP connection with server...");
  if (this->tcp.connect(serverAddrBytes, this->serverPort)) {
    this->packetReader.reset(this->voxelModel);
    this->setState(MasterClient::CONNECTED);
    Serial.println("TCP socket is open, connected to server.");
  }
  else {
    Serial.println("Failed to connect / open TCP socket.");
    Serial.print("Rediscovering server...");
    this->setState(MasterClient::DISCOVERING);
  }
}

void MasterClient::receiveServerPacket(unsigned long dtMicroSecs) {
  if (this->state != MasterClient::CONNECTED) {
    return;
  }

  if (!this->tcp.status()) {
    if (!this->tcp.connected()) {
      Serial.print("TCP Socket is disconnected, rediscovering server...");
      this->setState(MasterClient::CONNECTING);
      return;
    }
  }

  /*
  if (!this->packetReader.read(this->tcp, this->voxelModel, dtMicroSecs)) {
    Serial.print("Error while reading packet, rediscovering server...");
    this->setState(MasterClient::CONNECTING);
    return;
  }
  */

  if (!this->packetReader.readUDP(this->udp, this->voxelModel, dtMicroSecs)) {
    Serial.print("Error while reading UDP packet.");
  }


}

void MasterClient::sendSlavePackets(unsigned long dtMicroSecs) {
  static unsigned long sumOfMicroSecsBetween = 0;
  static unsigned long timeSinceLastWrite = 0;
  static unsigned long count = 0;
  timeSinceLastWrite += dtMicroSecs;

  if (this->slavePacketWriter.isReady()) {
    count++;
    sumOfMicroSecsBetween += timeSinceLastWrite;
    timeSinceLastWrite = 0;

    if (count % 100 == 0) {
      Serial.printlnf("Average microsecs between slave serial writes: %i", sumOfMicroSecsBetween/count);
    }
  }

  this->slavePacketWriter.write(this->voxelModel);
}