import * as THREE from 'three';

import VoxelAnimator from './VoxelAnimator';
import VoxelColourAnimator from './VoxelColourAnimator';

import {VOXEL_EPSILON} from '../MathUtils';

export const shootingStarAnimatorDefaultConfig = {
  colour: {r:1, g:1, b:1},
  startPosition: {x:0, y:0, z:0},
  velocity: {x:1, y:0, z:0},
  fadeTimeSecs: 2.0,
};

/**
 * The ShootingStarAnimator will animate a single "shooting star", a voxel
 * that has a tail which moves from a given starting position in a given
 * direction until it has left the display.
 */
class ShootingStarAnimator extends VoxelAnimator {
  constructor(voxels, config = shootingStarAnimatorDefaultConfig) {
    super(voxels, config);
    this.reset();
  }

  setConfig(c) {
    super.setConfig(c);
    const {startPosition, velocity} = c;

    if (startPosition !== this.startPosition) {
      this.startPosition = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    }
    if (startPosition !== this.currPosition) {
      this.currPosition = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    }
    if (velocity !== this.velocity) {
      this.velocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    }
  }

  addPositionToAnimatorMap(pos) {
    const {colour, fadeTimeSecs} = this.config;

    // Check to see if the current position has an animator yet...
    for (let i = 0; i < this.currAnimatorMap.length; i++) {
      if (this.currAnimatorMap[i].voxelPosition.distanceToSquared(pos) < VOXEL_EPSILON) {
        return false;
      }
    }

    // No animator exists for the given position / voxel, create one.
    const animatorObj = {
      voxelPosition: pos,
      animator: new VoxelColourAnimator(this.voxels, {
        voxelPositions: [pos],
        colourStart: colour,
        colourEnd: {r:0, g:0, b:0},
        startTimeSecs: 0.0,
        endTimeSecs: fadeTimeSecs,
      }),
    };
    this.currAnimatorMap.push(animatorObj);

    return true;
  }

  animate(dt) {
    if (this.animationFinished) {
      return;
    }

    super.animate(dt);

    const roundedCurrPos = this.currPosition.clone().round();
    const currPosInBounds = this.voxels.isInBounds(this.currPosition);
    if (currPosInBounds) {
      this.addPositionToAnimatorMap(roundedCurrPos);
    }

    // Go through all the animators and animate the active ones
    this.currAnimatorMap.forEach((animatorObj) => {
      animatorObj.animator.animate(dt);
    });

    // Clean up all finished animations
    this.currAnimatorMap = this.currAnimatorMap.filter((animatorObj) => (!animatorObj.animator.animationFinished));

    // Check to see whether this shooting star is finished i.e., is out of bounds, not heading towards
    // the bounds, and has no animations left
    if (this.currAnimatorMap.length === 0 && !currPosInBounds) {
      const nVelocity = this.velocity.clone().normalize();
      const velocityRay = new THREE.Ray(this.currPosition, nVelocity);
      const voxelsBox = this.voxels.voxelDisplayBox();
      if (velocityRay.intersectBox(voxelsBox) === null) {
        this.animationFinished = true;
        return;
      }
    }

    const sampleStepSize = this.voxels.voxelSizeInUnits() / (2 + VOXEL_EPSILON); // Sample at a reasonable enough rate
    const sqSampleStepSize = sampleStepSize * sampleStepSize;
    const incVelocity = this.velocity.clone().multiplyScalar(dt);
    const sqLenIncVel = incVelocity.lengthSq();

    // Perform sampling along the velocity addition in increments equal to a properly sized interval
    // to ensure we don't skip voxels
    if (sqLenIncVel > sqSampleStepSize) {
      const numSamples = Math.floor(incVelocity.length() / sampleStepSize);
      const nVelocity = this.velocity.clone().normalize();
      for (let i = 1; i <= numSamples; i++) {
        const samplePos = this.currPosition.clone().add(nVelocity.clone().multiplyScalar(i*sampleStepSize));
        this.addPositionToAnimatorMap(samplePos.round());
      }
    }
    
    this.currPosition.add(incVelocity);
  }

  reset() {
    super.reset();
    this.currAnimatorMap = []; // An array of voxel positions to active animators
    this.animationFinished = false;
    this.currPosition.set(this.startPosition.x, this.startPosition.y, this.startPosition.z);
  }
};

export default ShootingStarAnimator;