/******************************************************/
//       THIS IS A GENERATED FILE - DO NOT EDIT       //
/******************************************************/

#include "Particle.h"
#line 1 "g:/projects/led3d/src/embedded/master/src/master.ino"
 
#include "../lib/led3d/comm.h"
#include "../lib/led3d/voxel.h"

#include "VoxelModel.h"
#include "MasterClient.h"

void onSerialPacketReceived(const uint8_t* buffer, size_t size);
void setup();
void loop();
#line 8 "g:/projects/led3d/src/embedded/master/src/master.ino"
led3d::LED3DPacketSerial slaveSerial;
//static uint8_t packetBuffer[PACKET_BUFFER_MAX_SIZE];

VoxelModel voxelModel;
MasterClient client(voxelModel, slaveSerial);

static unsigned long TIME_UNTIL_RESEND_INIT_PACKET_MICROSECS = (30*1000000);
static unsigned long resendInitPacketCounterMicroSecs = TIME_UNTIL_RESEND_INIT_PACKET_MICROSECS;

// Recieve incoming serial packets from slave(s)
void onSerialPacketReceived(const uint8_t* buffer, size_t size) {
  Serial.println("Packet recieved on master.");
}

void setup() {
  #if defined(DEBUG_BUILD)
  Mesh.off();
  BLE.off();
  #endif

  Serial.begin(9600); // USB Serial

  Serial1.begin(PACKET_SERIAL_BAUD);
  slaveSerial.setStream(&Serial1);
  slaveSerial.setPacketHandler(&onSerialPacketReceived);

  resendInitPacketCounterMicroSecs = TIME_UNTIL_RESEND_INIT_PACKET_MICROSECS;

  // Setup the client - whenever it connects to the network it tries to discover the server, it has a state
  // machine that will listen for the appropriate data and take actions based on that
  client.begin();
}

void loop() {

  // Keep track of frame time
  static unsigned long lastTimeInMicroSecs = micros();
  unsigned long currTimeMicroSecs = micros();
  unsigned long dtMicroSecs = currTimeMicroSecs - lastTimeInMicroSecs;
  lastTimeInMicroSecs = currTimeMicroSecs;

  // Listen for incoming data, parse it, do the heavy lifting
  client.run(dtMicroSecs);
}