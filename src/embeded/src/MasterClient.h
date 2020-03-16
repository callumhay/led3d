#pragma once

#include "../slave/common/comm.h"
#include <vector>
#include <string>

class MasterClient {
public:
  enum StateType { 
    DISCOVERING = 0, 
    CONNECTING, 
    CONNECTED 
  };

  MasterClient();
  ~MasterClient();

  // This must be called at startup
  void begin() {
    this->state = DISCOVERING;
    this->udp.begin(this->udpPort);
    this->udp.joinMulticast(this->discoveryIP);
  }

  void run(unsigned long dtMicroSecs);

private:
  StateType state;
  
  UDP udp;
  TCPClient tcp;

  IPAddress discoveryIP;
  uint16_t udpPort;

  IPAddress serverAddr;
  uint16_t serverPort;

  unsigned long discoveryPacketTimerMicroSecs;

  void setState(const StateType& nextState);

  void sendDiscoveryPacket(unsigned long dtMicroSecs);
  void receiveDiscoveryAck();
  void initiateConnectionWithServer();
  void receiveServerPacket();

  void readUntil(std::vector<char>& buffer, char untilChar) {
    buffer.clear();
    while (this->udp.available()) {
      buffer.push_back(this->udp.read());
      if (buffer.back() == untilChar) {
        buffer.pop_back();
        break;
      }
    }
  }

};