
class SceneRenderer {
  constructor(scene, voxelModel) {
    this.scene = scene;
    this.voxelModel = voxelModel;
    this.timeCounter = 0;
  }
  clear() {
    this.scene.dispose();
    this._options = null;
  }

  build(options) {}

  rebuild(options) {
    this.clear();
    this.build(options);
    this._options = options;
  }
}

export default SceneRenderer;