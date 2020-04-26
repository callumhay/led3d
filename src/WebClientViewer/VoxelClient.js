import VoxelProtocol from "../VoxelProtocol";

class VoxelClient {
  constructor(voxelDisplay) {
    this.voxelDisplay = voxelDisplay;
    this.socket = new WebSocket('ws://' + VoxelProtocol.WEBSOCKET_HOST + ':' + VoxelProtocol.WEBSOCKET_PORT);
  }

  start(controlPanel) {
    this.socket.addEventListener('open', (event) => {
      console.log("Websocket open on " + event.currentTarget.url);
    });
    this.socket.addEventListener('error', (error) => {
      console.log("Websocket error: " + error);
    });
    this.socket.addEventListener('close', (event) => {
      console.log("Websocket closed.");
    });

    // Receiving messages from the Voxel Server
    this.socket.addEventListener('message', ((event) => {

      if (typeof event.data === 'string') {
        this.readPacket(controlPanel, event.data);
      }
      else {
        const reader = new FileReader();
        reader.addEventListener('loadend', () => {
          const messageData = new Uint8Array(reader.result);
          this.readPacket(controlPanel, messageData);
        });

        reader.readAsArrayBuffer(event.data);
      }

    }).bind(this));
  }

  readPacket(controlPanel, messageData) {
    const packetType = VoxelProtocol.readPacketType(messageData);
    switch (packetType) {

      case VoxelProtocol.SERVER_TO_CLIENT_WELCOME_HEADER:
        const welcomeDataObj = VoxelProtocol.getDataObjFromWelcomePacketStr(messageData);
        if (welcomeDataObj) {
          const {gridSize, currentAnimatorType, currentAnimatorConfig} = welcomeDataObj;

          if (gridSize !== undefined && gridSize !== this.voxelDisplay.gridSize) {
            console.log("Resizing the voxel grid.");
            this.voxelDisplay.rebuild(parseInt(gridSize));
          }
          if (currentAnimatorType && currentAnimatorConfig) {
            // TODO: Tell the GUI to update itself
            controlPanel.updateAnimator(currentAnimatorType, currentAnimatorConfig);
          }
        }
        break;

      case VoxelProtocol.VOXEL_DATA_HEADER:
        const voxelDataType = VoxelProtocol.readVoxelDataType(messageData);
        switch (voxelDataType) {
          
          case VoxelProtocol.VOXEL_DATA_ALL_TYPE:
            if (!VoxelProtocol.readAndPaintVoxelDataAll(messageData, this.voxelDisplay)) {
              console.log("Invalid voxel (all) data.");
            }
            break;
          
          case VoxelProtocol.VOXEL_DATA_CLEAR_TYPE:
            if (!VoxelProtocol.readAndPaintVoxelDataClear(messageData, this.voxelDisplay)) {
              console.log("Invalid clear colour.");
            }
            break;

          case VoxelProtocol.VOXEL_DATA_DIFF_TYPE:
          default:
            console.log("Unimplemented protocol voxel data type: " + voxelDataType);
            break;
        }
        break;

      default:
        console.log("Invalid packet type: " + packetType);
        break;
    }
  }

  sendAnimatorChangeCommand(animatorType, config) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(VoxelProtocol.buildClientPacketStr(VoxelProtocol.VOXEL_ROUTINE_CHANGE_HEADER, animatorType, config));
    }
  }
  sendConfigUpdateCommand(config) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(VoxelProtocol.buildClientPacketStr(VoxelProtocol.VOXEL_ROUTINE_CONFIG_UPDATE_HEADER, null, config));
    }
  }
  sendRoutineResetCommand() {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(VoxelProtocol.buildClientPacketStr(VoxelProtocol.VOXEL_ROUTINE_RESET_HEADER, null, null));
    }
  }
  sendClearCommand(r, g, b) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(VoxelProtocol.buildClientPacketStr(VoxelProtocol.VOXEL_CLEAR_COMMAND_HEADER, null, {r: r, g: g, b: b}));
    }
  }

}

export default VoxelClient;