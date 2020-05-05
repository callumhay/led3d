#include <OctoWS2811.h>

#include "../../master/lib/led3d/voxel.h"
#include "../../master/lib/led3d/comm.h"

#define DATA_SERIAL Serial

#define SLAVE_PING_MICROSECS 10e6 // Broadcast our information every 10 seconds or so

static const int REFRESH_RATE_HZ = 30;
static const unsigned long numMicroSecsPerRefresh = 1e6 / REFRESH_RATE_HZ;
static unsigned long ledDrawTimeCounterMicroSecs = 0;
static unsigned long slaveInfoPingTimeCounterMicroSecs = 0;

static int lastKnownFrameId = 0;

// Gamma correction for Neopixel LED strips - maps each of R, G, and B from uint8 value
// to a gamma corrected uint8 value ****************************************************
const uint8_t PROGMEM gamma8[] = {
    0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
    0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  1,  1,  1,  1,
    1,  1,  1,  1,  1,  1,  1,  1,  1,  2,  2,  2,  2,  2,  2,  2,
    2,  3,  3,  3,  3,  3,  3,  3,  4,  4,  4,  4,  4,  5,  5,  5,
    5,  6,  6,  6,  6,  7,  7,  7,  7,  8,  8,  8,  9,  9,  9, 10,
   10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16,
   17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 24, 24, 25,
   25, 26, 27, 27, 28, 29, 29, 30, 31, 32, 32, 33, 34, 35, 35, 36,
   37, 38, 39, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 50,
   51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68,
   69, 70, 72, 73, 74, 75, 77, 78, 79, 81, 82, 83, 85, 86, 87, 89,
   90, 92, 93, 95, 96, 98, 99,101,102,104,105,107,109,110,112,114,
  115,117,119,120,122,124,126,127,129,131,133,135,137,138,140,142,
  144,146,148,150,152,154,156,158,160,162,164,167,169,171,173,175,
  177,180,182,184,186,189,191,193,196,198,200,203,205,208,210,213,
  215,218,220,223,225,228,231,233,236,239,241,244,247,249,252,255
};

int gammaMapColour(int colour) {
  return (static_cast<int>(pgm_read_byte(&gamma8[colour >> 16 & 0x0000FF])) << 16) |
         (static_cast<int>(pgm_read_byte(&gamma8[colour >>  8 & 0x0000FF])) << 8)  |
          static_cast<int>(pgm_read_byte(&gamma8[colour & 0x0000FF]));
}

// OCTOWS2811 Constants/Variables *******************************************************
const int octoConfig = WS2811_GRB | WS2811_800kHz;

int voxelModuleYSize = 0;
int ledsPerStrip = voxelModuleYSize * VOXEL_MODULE_Z_SIZE;
int ledsPerModule = VOXEL_MODULE_X_SIZE * voxelModuleYSize * VOXEL_MODULE_Z_SIZE;

DMAMEM int displayMemory[MAX_VOXEL_Y_SIZE*VOXEL_MODULE_Z_SIZE*6]; // Maximum allowable ySize * zSize * 6
int drawingMemory[MAX_VOXEL_Y_SIZE*VOXEL_MODULE_Z_SIZE*6]; // Maximum allowable ySize * zSize * 6

// Circular buffer for the LEDs
#define LED_BUFFER_QUEUE_SIZE 6

uint8_t tempLedBufferQueue[LED_BUFFER_QUEUE_SIZE][VOXEL_MODULE_X_SIZE * MAX_VOXEL_Y_SIZE * VOXEL_MODULE_Z_SIZE * 3];
int queueCount;
int queueStartIdx;

void clearQueue() {
  queueCount = 0;
  queueStartIdx = 0;
}
void updateQueue() {
  queueCount++;
  if (queueCount > LED_BUFFER_QUEUE_SIZE) {
    queueStartIdx = (queueStartIdx + 1) % LED_BUFFER_QUEUE_SIZE;
    queueCount = LED_BUFFER_QUEUE_SIZE;
  }
}

OctoWS2811 leds(ledsPerStrip, displayMemory, drawingMemory, octoConfig);
// **************************************************************************************

const int MY_SLAVE_ID = 0;
led3d::LED3DPacketSerial myPacketSerial;

int colourFromBuffer(const uint8_t* buffer, int startIdx) {
  return gammaMapColour(((buffer[startIdx] & 0x0000FF) << 16)  + ((buffer[startIdx+1] & 0x0000FF) << 8) + (buffer[startIdx+2] & 0x0000FF));
}

/**
 * Reinitializes all of the LED-related variables / memory based on a new sizing for the module.
 * This is a costly operation, do not perform this regularly!
 */
void reinit(uint8_t ySize) {
  lastKnownFrameId = -1;
  clearQueue();

  if (ySize != voxelModuleYSize && ySize <= MAX_VOXEL_Y_SIZE) {
    Serial.print("Reinitializing LED array sizes, new ySize: ");
    Serial.println(ySize);

    voxelModuleYSize = ySize;
    ledsPerStrip = voxelModuleYSize * VOXEL_MODULE_Z_SIZE;
    ledsPerModule = VOXEL_MODULE_X_SIZE * voxelModuleYSize * VOXEL_MODULE_Z_SIZE;
    leds.begin(ledsPerStrip, displayMemory, drawingMemory, octoConfig);
    leds.show();
  }
}

void readWelcomeHeader(const uint8_t* buffer, size_t size, size_t startIdx) {
  Serial.println("Welcome Header / Init data recieved on slave.");
  if (size >= 1) {
    // There's only one byte and it defines the y module size
    uint8_t newYSize = buffer[startIdx];
    if (newYSize > 0) {
      reinit(newYSize);
    }
    else {
      Serial.println("ERROR: Received module y-size that was zero, ignoring.");
    }
  }

  lastKnownFrameId = -1;
  clearQueue();
}

int getFrameId(const uint8_t* buffer, size_t size) {
  return size > 3 ? static_cast<uint16_t>((buffer[2] << 8) + buffer[3]) : 0;
}

void readFullVoxelData(const uint8_t* buffer, size_t size, size_t startIdx, int frameId) {
  if (static_cast<int>(size) >= 3*ledsPerModule && ((frameId > 0 && frameId < 256) || frameId > lastKnownFrameId)) {

    // The buffer contains data as a continuous array of voxels with 3 bytes in RGB order
    // The ordering of the coordinates system is x,y,z; each indexed from zero, where
    // x defines the strip
    // y defines the height off the ground
    // z defines the column depth

    // Do a very fast copy into a temporary buffer inside a circular queue / ring buffer and then get out of here
    memcpy(&tempLedBufferQueue[(queueStartIdx + queueCount) % LED_BUFFER_QUEUE_SIZE][0], &buffer[startIdx], 3*ledsPerModule);
    updateQueue();

    lastKnownFrameId = frameId;
  }
  else {
    Serial.println("Throwing out frame.");
  }
}

void readWipeVoxelData(const uint8_t* buffer, size_t size, size_t startIdx, int frameId) {
  if (size > 2 && ((frameId > 0 && frameId < 256) || frameId > lastKnownFrameId)) {

    // Do a super fast wipe on the next frame of the queue/ring buffer
    uint8_t* currFrameBuffer = tempLedBufferQueue[(queueStartIdx + queueCount) % LED_BUFFER_QUEUE_SIZE]; 
    for (int i = 0; i < ledsPerModule; i += 3) {
      currFrameBuffer[i] = buffer[startIdx];
      currFrameBuffer[i+1] = buffer[startIdx+1];
      currFrameBuffer[i+2] = buffer[startIdx+2];
    }
    updateQueue();

    lastKnownFrameId = frameId;
  }
  else {
    Serial.println("Throwing out frame.");
  }
}

void onSerialPacketReceived(const void* sender, const uint8_t* buffer, size_t size) {
  if (sender == &myPacketSerial && size > 2) {
    
    // The first byte of the buffer has the ID of the slave that it's relevant to
    int bufferIdx = 0;
    uint8_t slaveId = buffer[bufferIdx++];

    //Serial.print("Received serial packet with slave ID: ");
    //Serial.println(slaveId);

    if (slaveId != MY_SLAVE_ID) {
      // Ignore
      return;
    }

    /*
    Serial.print("Serial packet received for this slave, type: '");
    Serial.print(static_cast<char>(buffer[1]));
    Serial.println("'");
    Serial.print("Buffer size: ");
    Serial.println(size);
    */

    // The second byte of the buffer describes the type of data, the rest will be the data itself
    switch (static_cast<char>(buffer[bufferIdx++])) {

      case WELCOME_HEADER:
        readWelcomeHeader(buffer, static_cast<size_t>(size-bufferIdx), bufferIdx);
        break;

      case VOXEL_DATA_ALL_TYPE:
        bufferIdx += 2; // Frame ID
        readFullVoxelData(buffer, static_cast<size_t>(size-bufferIdx), bufferIdx, getFrameId(buffer, size));
        break;

      case VOXEL_DATA_CLEAR_TYPE:
        bufferIdx += 2; // Frame ID
        readWipeVoxelData(buffer, static_cast<size_t>(size-bufferIdx), bufferIdx, getFrameId(buffer, size));
        break;

      default:
        Serial.println("Unspecified packet recieved on slave.");
        break;
    }
  }
}

bool updateLedsFromQueue() {
  if (queueCount > 0) {
    int bufferIdx = 0;
    for (int x = 0; x < VOXEL_MODULE_X_SIZE; x++) {
      for (int y = 0; y < voxelModuleYSize; y++) {
        for (int z = 0; z < VOXEL_MODULE_Z_SIZE; z++) {

          // Each colour is encoded as 3 bytes in the buffer (RGB)
          int currColour = colourFromBuffer(tempLedBufferQueue[queueStartIdx], bufferIdx);
          bufferIdx += 3;

          // Every x we move moves us to a new wire on the octo (goes through ySize*zSize LEDs)
          // Every y we move goes up the current wire on the octo by a single LED
          // Every z we move jumps through the same wire on the octo by ySize LEDs
          leds.setPixel(x*voxelModuleYSize*VOXEL_MODULE_Z_SIZE + z*voxelModuleYSize + y, currColour);
        }
      }
    }

    leds.show();
    queueCount--;
    queueStartIdx = (queueStartIdx+1) % LED_BUFFER_QUEUE_SIZE;

    //Serial.print("queueStartIdx: "); Serial.println(queueStartIdx);
    //Serial.print("queueCount: "); Serial.println(queueCount);

    return true;
  }

  /*
  static int tempCount = 0;
  if (tempCount % 100 == 0) {
    Serial.println("Empty LED buffer!");
  }
  tempCount++;
  */

  //Serial.print("queueStartIdx: "); Serial.println(queueStartIdx);
  //Serial.print("queueCount: "); Serial.println(queueCount);

  return false;
}

void setup() {
  // Serial for receiving render data
  DATA_SERIAL.begin(PACKET_SERIAL_BAUD);
  myPacketSerial.setStream(&DATA_SERIAL);
  myPacketSerial.setPacketHandler(&onSerialPacketReceived);

  lastKnownFrameId = 0;
  slaveInfoPingTimeCounterMicroSecs = 0;
  ledDrawTimeCounterMicroSecs = 0;

  reinit(VOXEL_MODULE_X_SIZE);
}

void loop() {
  // Update from incoming serial data
  myPacketSerial.update();
  if (myPacketSerial.overflow()) {
    Serial.println("Serial buffer overflow.");
  }

  static unsigned long lastTimeInMicroSecs = micros();

  unsigned long currTimeMicroSecs = micros();
  unsigned long dtMicroSecs = currTimeMicroSecs - lastTimeInMicroSecs;
  lastTimeInMicroSecs = currTimeMicroSecs;

  // Synchronize updates to the specified REFRESH_RATE_HZ
  ledDrawTimeCounterMicroSecs += dtMicroSecs;
  if (ledDrawTimeCounterMicroSecs >= numMicroSecsPerRefresh && updateLedsFromQueue()) {
    ledDrawTimeCounterMicroSecs = 0;
  }

  // Ping the server with our info every once in a while
  slaveInfoPingTimeCounterMicroSecs += dtMicroSecs;
  if (slaveInfoPingTimeCounterMicroSecs > SLAVE_PING_MICROSECS) {
    Serial.print("SLAVE_ID "); Serial.println(MY_SLAVE_ID);
    slaveInfoPingTimeCounterMicroSecs = 0;
  }
}