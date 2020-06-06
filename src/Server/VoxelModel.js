import * as THREE from 'three';
import {VOXEL_ERR_UNITS, clamp} from '../MathUtils';

import VoxelAnimator from '../Animation/VoxelAnimator';
import VoxelColourAnimator from '../Animation/VoxelColourAnimator';
import StarShowerAnimator from '../Animation/StarShowerAnimator';
import ShapeWaveAnimator from '../Animation/ShapeWaveAnimator';
import GameOfLifeAnimator from '../Animation/GameOfLifeAnimator';
import FireAnimator from '../Animation/FireAnimator';
import SceneAnimator from '../Animation/SceneAnimator';
import AudioVisualizerAnimator from '../Animation/AudioVisualizerAnimator';

export const HALF_VOXEL_SIZE = 0.5;

export const BLEND_MODE_OVERWRITE = 0;
export const BLEND_MODE_ADDITIVE  = 1;

const DEFAULT_POLLING_FREQUENCY_HZ = 60; // 60 FPS - if this is too high then we overwhelm our embedded hardware...
const DEFAULT_POLLING_INTERVAL_MS  = 1000 / DEFAULT_POLLING_FREQUENCY_HZ;

class VoxelModel {

  constructor(gridSize) {

    this.gridSize = gridSize;
    this.blendMode = BLEND_MODE_OVERWRITE;
    
    // Build the 3D array of voxels
    this.voxels = [];
    for (let x = 0; x < gridSize; x++) {
      let currXArr = [];
      this.voxels.push(currXArr);
      for (let y = 0; y < gridSize; y++) {
        let currYArr = [];
        currXArr.push(currYArr);
        for (let z = 0; z < gridSize; z++) {
          const voxelObj = {
            position: new THREE.Vector3(x,y,z),
            colour: new THREE.Color(0,0,0),
            setColourRGB: function(r, g, b) { this.colour.setRGB(r,g,b); },
            setColour: function(colour) { this.colour.setRGB(colour.r, colour.g, colour.b); },
            addColour: function(colour) { 
              this.colour.add(colour); 
              this.colour.setRGB(clamp(this.colour.r, 0, 1), clamp(this.colour.g, 0, 1), clamp(this.colour.b, 0, 1));
            },
          };
          currYArr.push(voxelObj);
        }
      }
    }

    this._animators = {
      [VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR]: new VoxelColourAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER] : new StarShowerAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES] : new ShapeWaveAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_TYPE_GAME_OF_LIFE] : new GameOfLifeAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_FIRE] : new FireAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_SCENE] : new SceneAnimator(this),
      [VoxelAnimator.VOXEL_ANIM_SOUND_VIZ] : new AudioVisualizerAnimator(this),
    };
    this.currentAnimator = this._animators[VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR];

    this.currFrameTime = Date.now();
    this.frameCounter = 0;
  }

  xSize() {
    return this.voxels.length;
  }
  ySize() {
    return this.voxels[0].length;
  }
  zSize() {
    return this.voxels[0][0].length;
  }

  setAnimator(type, config) {
    if (!(type in this._animators)) {
      return false;
    }

    const nextAnimator = this._animators[type];
    if (this.currentAnimator !== nextAnimator) {
      this.currentAnimator.stop();
    }

    this.currentAnimator = nextAnimator;
    if (config) {
      this.currentAnimator.setConfig(config);
    }

    return true;
  }

  run(voxelServer) {
    let self = this;
    let lastFrameTime = Date.now();
    let dt = 0;
    let dtSinceLastRender = 0;

    const allowableEventLoopBackupSize = DEFAULT_POLLING_FREQUENCY_HZ;
    const allowablePollingMsBackupSize = allowableEventLoopBackupSize * DEFAULT_POLLING_INTERVAL_MS; // 1 second

    setInterval(function() {

      self.currFrameTime = Date.now();
      dt = (self.currFrameTime - lastFrameTime) / 1000;
      dtSinceLastRender += dt;

      // If it's taking longer to render than the setInterval time then we need to not
      // waste our time rendering and let the node/javascript event loop catch up
      if (dt <= allowablePollingMsBackupSize) {
        // Simulate the model based on the current animation...
        if (self.currentAnimator) {
          self.currentAnimator.render(dtSinceLastRender);
        }
        dtSinceLastRender = 0;

        // Let the server know to broadcast the new voxel data to all clients
        voxelServer.setVoxelData(self.voxels, self.frameCounter);
      }

      lastFrameTime = self.currFrameTime;
      self.frameCounter++;
      //console.log(self.frameCounter % 0xFFFF);

    }, DEFAULT_POLLING_INTERVAL_MS);
  }

  /**
   * Build a flat list of all of the possible voxel indices (x,y,z) in this display
   * as a list of THREE.Vector3 objects.
   */
  voxelIndexList() {
    const idxList = [];
    for (let x = 0; x < this.voxels.length; x++) {
      for (let y = 0; y < this.voxels[x].length; y++) {
        for (let z = 0; z < this.voxels[x][y].length; z++) {
          idxList.push(new THREE.Vector3(x,y,z));
        }
      }
    }
    return idxList;
  }

  /**
   * Check whether the given point is in the local space bounds of the voxels.
   * @param {THREE.Vector3} pt 
   */
  isInBounds(pt) {
    const roundedX = Math.floor(pt.x);
    const roundedY = Math.floor(pt.y);
    const roundedZ = Math.floor(pt.z);

    return roundedX >= 0 && roundedX < this.voxels.length &&
      roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
      roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length;
  }

  /**
   * Get the local space Axis-Aligned Bounding Box for all voxels.
   */
  getBoundingBox() {
    return new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(this.xSize(), this.ySize(), this.zSize()));
  }
  

  
  setVoxel(pt, colour) {
    const roundedX = Math.floor(pt.x);
    const roundedY = Math.floor(pt.y);
    const roundedZ = Math.floor(pt.z);

    if (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) {

      this.voxels[roundedX][roundedY][roundedZ].setColour(colour);
    } 
  }
  getVoxel(pt) {
    const roundedX = Math.floor(pt.x);
    const roundedY = Math.floor(pt.y);
    const roundedZ = Math.floor(pt.z);

    return (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) ?
        this.voxels[roundedX][roundedY][roundedZ] : null;
  }

  addToVoxel(pt, colour) {
    const roundedX = Math.floor(pt.x);
    const roundedY = Math.floor(pt.y);
    const roundedZ = Math.floor(pt.z);

    if (roundedX >= 0 && roundedX < this.voxels.length &&
        roundedY >= 0 && roundedY < this.voxels[roundedX].length &&
        roundedZ >= 0 && roundedZ < this.voxels[roundedX][roundedY].length) {

      const voxel = this.voxels[roundedX][roundedY][roundedZ];
      voxel.addColour(colour);
    } 
  }

  clear(colour) {
    for (let x = 0; x < this.voxels.length; x++) {
      for (let y = 0; y < this.voxels[x].length; y++) {
        for (let z = 0; z < this.voxels[x][y].length; z++) {
          this.voxels[x][y][z].setColour(colour);
        }
      }
    }
  }

  voxelColour(pt) {
    return this.getVoxel(pt).colour;
  }

  static calcVoxelBoundingBox(voxelPt) {
    const roundedX = Math.floor(voxelPt.x);
    const roundedY = Math.floor(voxelPt.y);
    const roundedZ = Math.floor(voxelPt.z);

    return new THREE.Box3(
      new THREE.Vector3(roundedX, roundedY, roundedZ), 
      new THREE.Vector3(roundedX+1, roundedY+1, roundedZ+1)
    );
  }

  static closestVoxelIdxPt(pt) {
    return new THREE.Vector3(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.z));
  }

  static calcVoxelWorldSpaceCentroid(idxSpacePt) {
    return new THREE.Vector3(
      Math.floor(idxSpacePt.x) + HALF_VOXEL_SIZE, 
      Math.floor(idxSpacePt.y) + HALF_VOXEL_SIZE,
      Math.floor(idxSpacePt.z) + HALF_VOXEL_SIZE
    );
  }

  /**
   * Draw a coloured point (the point will be sampled to the nearest voxel).
   * @param {THREE.Vector3} pt - The position to draw the point at.
   * @param {THREE.Color} colour - The colour of the point
   */
  drawPoint(pt, colour) {
    switch (this.blendMode) {

      case BLEND_MODE_ADDITIVE:
        this.addToVoxel(pt, colour);
        break;

      case BLEND_MODE_OVERWRITE:
      default:
        this.setVoxel(pt, colour);
        break;
    }
  }

 /**
   * Draw a line through voxel space from the start point to the end point with the given colour.
   * @param {Vector3} p1 - The position where the line starts, in local coordinates.
   * @param {Vector3} p2 - The position where the line ends, in local coordinates.
   * @param {Color} colour - The colour of the line.
   */
  drawLine(p1, p2, colour) {
    // Code originally written by Anthony Thyssen, original algo of Bresenham's line in 3D
		// http://www.ict.griffith.edu.au/anthony/info/graphics/bresenham.procs

		let dx, dy, dz, l, m, n, dx2, dy2, dz2, i, x_inc, y_inc, z_inc, err_1, err_2;
		let currentPoint = new THREE.Vector3(p1.x, p1.y, p1.z);
		dx = p2.x - p1.x;
		dy = p2.y - p1.y;
		dz = p2.z - p1.z;
		x_inc = (dx < 0) ? -1 : 1;
		l = Math.abs(dx);
		y_inc = (dy < 0) ? -1 : 1;
		m = Math.abs(dy);
		z_inc = (dz < 0) ? -1 : 1;
		n = Math.abs(dz);
		dx2 = l * 2;
		dy2 = m * 2;
		dz2 = n * 2;

		if ((l >= m) && (l >= n)) {
			err_1 = dy2 - l;
			err_2 = dz2 - l;
			for (i = 0; i < l; i++) {
				this.drawPoint(currentPoint, colour);
				if (err_1 > 0) {
					currentPoint.y += y_inc;
					err_1 -= dx2;
				}
				if (err_2 > 0) {
					currentPoint.z += z_inc;
					err_2 -= dx2;
				}
				err_1 += dy2;
				err_2 += dz2;
				currentPoint.x += x_inc;
			}
    } 
    else if ((m >= l) && (m >= n)) {
			err_1 = dx2 - m;
			err_2 = dz2 - m;
			for (i = 0; i < m; i++) {
				this.drawPoint(currentPoint, colour);
				if (err_1 > 0) {
					currentPoint.x += x_inc;
					err_1 -= dy2;
				}
				if (err_2 > 0) {
					currentPoint.z += z_inc;
					err_2 -= dy2;
				}
				err_1 += dx2;
				err_2 += dz2;
				currentPoint.y += y_inc;
			}
    }
    else {
			err_1 = dy2 - n;
			err_2 = dx2 - n;
			for (i = 0; i < n; i++) {
        this.drawPoint(currentPoint, colour);
				if (err_1 > 0) {
					currentPoint.y += y_inc;
					err_1 -= dz2;
				}
				if (err_2 > 0) {
					currentPoint.x += x_inc;
					err_2 -= dz2;
				}
				err_1 += dy2;
				err_2 += dx2;
				currentPoint.z += z_inc;
			}
		}

		this.drawPoint(currentPoint, colour);
  }

  static voxelBoxList(minPt=new THREE.Vector3(0,0,0), maxPt=new THREE.Vector3(1,1,1), fill=false) {
    
    const voxelPts = [];
    const mappedMinPt = minPt.clone().floor();
    const mappedMaxPt  = maxPt.clone().ceil();

    if (fill) {
      for (let x = mappedMinPt.x; x < mappedMaxPt.x; x++) {
        for (let y = mappedMinPt.y; y < mappedMaxPt.y; y++) {
          for (let z = mappedMinPt.z; z < mappedMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }
    }
    else {
      // Not filling the box... just go around the outside of it
      let incX = Math.floor(mappedMaxPt.x-mappedMinPt.x);
      if (incX <= 0) {
        incX = mappedMaxPt.x-mappedMinPt.x;
      }

      for (let x = mappedMinPt.x; x <= mappedMaxPt.x; x += incX) {
        for (let y = mappedMinPt.y; y <= mappedMaxPt.y; y++) {
          for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }

      let incY = Math.floor(mappedMaxPt.y-mappedMinPt.y);
      if (incY <= 0) {
        incY = mappedMaxPt.y-mappedMinPt.y;
      }

      for (let y = mappedMinPt.y; y <= mappedMaxPt.y; y += incY) {
        for (let x = mappedMinPt.x+1; x < mappedMaxPt.x; x++) {
          for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }

      let incZ = Math.floor(mappedMaxPt.z-mappedMinPt.z);
      if (incZ <= 0) {
        incZ = mappedMaxPt.z-mappedMinPt.z;
      }

      for (let z = mappedMinPt.z; z <= mappedMaxPt.z; z += incZ) {
        for (let x = mappedMinPt.x+1; x < mappedMaxPt.x; x++) {
          for (let y = mappedMinPt.y+1; y < mappedMaxPt.y; y++) {
            voxelPts.push(new THREE.Vector3(x,y,z));
          }
        }
      }
    }

    return voxelPts;
  }

  drawBox(minPt=new THREE.Vector3(0,0,0), maxPt=new THREE.Vector3(1,1,1), colour=new THREE.Color(1,1,1), fill=false) {
    const boxPts = VoxelModel.voxelBoxList(minPt, maxPt, fill);
    boxPts.forEach((pt) => {
      this.drawPoint(pt, colour);
    });
  }

  voxelSphereList(center=new THREE.Vector3(0,0,0), radius=1, fill=false) {
    // Create a bounding box for the sphere: 
    // Centered at the given center with a half width/height/depth of the given radius
    const sphereBounds = new THREE.Sphere(center, radius);
    const sphereBoundingBox = new THREE.Box3(center.clone().subScalar(radius).floor(), center.clone().addScalar(radius).ceil());

    // Now we go through all the voxels in the bounding box and build a point list
    const voxelPts = [];
    for (let x = sphereBoundingBox.min.x; x <= sphereBoundingBox.max.x; x++) {
      for (let y = sphereBoundingBox.min.y; y <= sphereBoundingBox.max.y; y++) {
        for (let z = sphereBoundingBox.min.z; z <= sphereBoundingBox.max.z; z++) {
          // Check whether the current voxel is inside the radius of the sphere
          const currPt = new THREE.Vector3(x,y,z);
          const distToCurrPt = sphereBounds.distanceToPoint(currPt);
          if (fill) {
            if (distToCurrPt < VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }
          else {
            if (Math.abs(distToCurrPt) < VOXEL_ERR_UNITS) {
              voxelPts.push(currPt);
            }
          }
        }
      }
    }

    return voxelPts;
  }

  drawSphere(center=new THREE.Vector3(0,0,0), radius=1, colour=new THREE.Color(1,1,1), fill=false) {
    const spherePts = this.voxelSphereList(center, radius, fill);
    spherePts.forEach((pt) => {
      this.drawPoint(pt, colour);
    });
  }
}

export default VoxelModel;