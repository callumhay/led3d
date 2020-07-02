import * as dat from 'dat.gui';
import * as THREE from 'three';

import VoxelAnimator, {DEFAULT_CROSSFADE_TIME_SECS} from '../Animation/VoxelAnimator';
import {voxelColourAnimatorDefaultConfig, INTERPOLATION_TYPES} from '../Animation/VoxelColourAnimator';
import {starShowerDefaultConfig} from '../Animation/StarShowerAnimator';
import {shapeWaveAnimatorDefaultConfig, WAVE_SHAPE_TYPES} from '../Animation/ShapeWaveAnimator';
import {gameOfLifeAnimatorDefaultConfig} from '../Animation/GameOfLifeAnimator';
import {fireAnimatorDefaultConfig} from '../Animation/FireAnimator';
import {sceneAnimatorDefaultConfig, SCENE_TYPES, SCENE_TYPE_SIMPLE, SCENE_TYPE_SHADOW, SCENE_TYPE_FOG} from '../Animation/SceneAnimatorDefaultConfigs';
import {soundVisDefaultConfig, SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE, SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE, SOUND_VIZ_TYPES, SOUND_VIZ_FIRE_SCENE_TYPE} from '../Animation/AudioVisAnimatorDefaultConfigs';

import {ColourSystems, COLOUR_INTERPOLATION_TYPES} from '../Spectrum';

import {simpleSceneDefaultOptions, shadowSceneDefaultOptions, fogSceneDefaultOptions} from '../VoxelTracer/Scenes/SceneDefaultConfigs';

import {
  basicBarsAudioVisDefaultConfig, historyBarsAudioVisDefaultConfig, fireAudioVisDefaultConfig, 
  DIRECTION_TYPES, COLOUR_MODES, LOW_HIGH_TEMP_COLOUR_MODE, TEMPERATURE_COLOUR_MODE, RANDOM_COLOUR_MODE} from "../VoxelTracer/Scenes/Audio/AudioSceneDefaultConfigs";

const VOXEL_COLOUR_SHAPE_TYPE_ALL    = "All";
const VOXEL_COLOUR_SHAPE_TYPE_SPHERE = "Sphere";
const VOXEL_COLOUR_SHAPE_TYPE_BOX    = "Box";
const VOXEL_COLOUR_SHAPE_TYPES = [
  VOXEL_COLOUR_SHAPE_TYPE_ALL,
  VOXEL_COLOUR_SHAPE_TYPE_SPHERE,
  VOXEL_COLOUR_SHAPE_TYPE_BOX,
];

const THREEColorToGuiColor = (c) => {
  return [parseInt(c.r*255),parseInt(c.g*255),parseInt(c.b*255)];
}
const GuiColorToRGBObj = (c) => {
  return {
    r: parseFloat(c[0])/255.0, 
    g: parseFloat(c[1])/255.0, 
    b: parseFloat(c[2])/255.0
  };
}

class ControlPanel {
  constructor(voxelClient, voxelDisplay, soundController) {
    
    this.gui = new dat.GUI({preset:'Default'});
    this.voxelClient  = voxelClient;
    this.voxelDisplay = voxelDisplay;

    this.soundController = soundController;

    this.colourAnimatorConfig = {...voxelColourAnimatorDefaultConfig};
    this.starShowerAnimatorConfig = {...starShowerDefaultConfig};
    this.shapeWaveAnimatorConfig = {...shapeWaveAnimatorDefaultConfig};
    this.gameOfLifeAnimatorConfig = {...gameOfLifeAnimatorDefaultConfig};
    this.fireAnimatorConfig = {...fireAnimatorDefaultConfig};
    this.sceneAnimatorConfig = {...sceneAnimatorDefaultConfig};
    this.sceneAnimatorConfig.sceneOptions = {...sceneAnimatorDefaultConfig.sceneOptions};
    this.soundVizAnimatorConfig = {...soundVisDefaultConfig};
    this.soundVizAnimatorConfig.sceneConfig = {...soundVisDefaultConfig.sceneConfig};

    this.settings = {};
    this.reloadSettings();
    
    this.currFolder = null;
    this.shapeSettingsFolder = null;
    this.sceneSettingsFolder = null;
    this.audioVizSettingsFolder = null;

    this.animatorTypeController = this.gui.add(this.settings, 'animatorType', [
      VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR,
      VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER,
      VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES,
      VoxelAnimator.VOXEL_ANIM_FIRE,
      VoxelAnimator.VOXEL_ANIM_SCENE,
      VoxelAnimator.VOXEL_ANIM_SOUND_VIZ,
      //VoxelAnimator.VOXEL_ANIM_TYPE_GAME_OF_LIFE, // Meh... not very impressed by this, maybe when we have a much bigger grid
    ]).onChange((value) => {

      // Clear the display and remove any GUI elements from before
      if (this.currFolder) {
        this.gui.removeFolder(this.currFolder);
        this.currFolder = null;
        this.shapeSettingsFolder = null;
        this.sceneSettingsFolder = null;
        this.audioVizSettingsFolder = null;
        this.audioVizTypeFolder = null;
      }

      switch (value) {
        case VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR:
          this.currFolder = this.buildVoxelColourControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
          break;

        case VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER:
          this.currFolder = this.buildStarShowerAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
          break;

        case VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES:
          this.currFolder = this.buildShapeWavesAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
          break;
        
        case VoxelAnimator.VOXEL_ANIM_TYPE_GAME_OF_LIFE:
          this.currFolder = this.buildGameOfLifeAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_GAME_OF_LIFE, this.gameOfLifeAnimatorConfig);
          break;

        case VoxelAnimator.VOXEL_ANIM_FIRE:
          this.currFolder = this.buildFireAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
          break;
        
        case VoxelAnimator.VOXEL_ANIM_SCENE:
          this.currFolder = this.buildSceneAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          break;
        
        case VoxelAnimator.VOXEL_ANIM_SOUND_VIZ:
          this.currFolder = this.buildSoundVizAnimatorControls();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          this.soundController.enabled = true;
          break;

        default:
          console.error("Animator type Not implemented!");
          break;
      }

      voxelClient.sendClearCommand(0,0,0);
      if (value !== VoxelAnimator.VOXEL_ANIM_SOUND_VIZ) {
        this.soundController.enabled = false;
      }

    }).setValue(this.settings.animatorType);

    this.gui.add(this.settings, 'showWireFrame').onChange((value) => {
      this.voxelDisplay.setOutlinesEnabled(value);
    }).setValue(this.settings.showWireFrame);
    this.gui.add(this.settings, 'orbitMode').onChange((value) => {
      this.voxelDisplay.setOrbitModeEnabled(value);
    }).setValue(this.settings.orbitMode);
    this.gui.add(this.settings, 'crossfadeTime', 0, 10, 0.1).onChange((value) => {
      this.voxelClient.sendCrossfadeTime(value);
    }).setValue(this.settings.crossfadeTime);
    
    this.gui.open();
  }

  resetDisplay() {
    this.voxelClient.sendRoutineResetCommand();
    this.voxelClient.sendClearCommand(0, 0, 0);
  }

  reloadVoxelColourSettings() {
    const halfVoxelDisplayUnits = (this.voxelClient.voxelDisplay.gridSize - 1) / 2;
    this.settings.voxelColourSettings = {...this.colourAnimatorConfig,
      shapeType: VOXEL_COLOUR_SHAPE_TYPE_ALL,
      sphereProperties: { center: { x: halfVoxelDisplayUnits, y: halfVoxelDisplayUnits, z: halfVoxelDisplayUnits }, radius: halfVoxelDisplayUnits, fill: false },
      boxProperties: { center: { x: halfVoxelDisplayUnits, y: halfVoxelDisplayUnits, z: halfVoxelDisplayUnits }, width: 2 * halfVoxelDisplayUnits - 2, height: 2 * halfVoxelDisplayUnits - 2, depth: 2 * halfVoxelDisplayUnits - 2, fill: false },
      colourStart: THREEColorToGuiColor(this.colourAnimatorConfig.colourStart),
      colourEnd: THREEColorToGuiColor(this.colourAnimatorConfig.colourEnd),
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.voxelColourSettings);
    this.gui.remember(this.settings.voxelColourSettings.sphereProperties);
    this.gui.remember(this.settings.voxelColourSettings.sphereProperties.center);
    this.gui.remember(this.settings.voxelColourSettings.boxProperties);
    this.gui.remember(this.settings.voxelColourSettings.boxProperties.center);
  }
  reloadStarShowerSettings() {
    this.settings.starShowerSettings = {
      minSpawnPos: { x: this.starShowerAnimatorConfig.positionRandomizer.min.x, y: this.starShowerAnimatorConfig.positionRandomizer.min.y, z: this.starShowerAnimatorConfig.positionRandomizer.min.z },
      maxSpawnPos: { x: this.starShowerAnimatorConfig.positionRandomizer.max.x, y: this.starShowerAnimatorConfig.positionRandomizer.max.y, z: this.starShowerAnimatorConfig.positionRandomizer.max.z },
      direction: { x: this.starShowerAnimatorConfig.directionRandomizer.baseDirection.x, y: this.starShowerAnimatorConfig.directionRandomizer.baseDirection.y, z: this.starShowerAnimatorConfig.directionRandomizer.baseDirection.z },
      directionVariance: this.starShowerAnimatorConfig.directionRandomizer.radAngle, // [0, PI]
      speedMin: this.starShowerAnimatorConfig.speedRandomizer.min,
      speedMax: this.starShowerAnimatorConfig.speedRandomizer.max,
      spawnRate: this.starShowerAnimatorConfig.spawnRate,
      colourMin: THREEColorToGuiColor(this.starShowerAnimatorConfig.colourRandomizer.min),
      colourMax: THREEColorToGuiColor(this.starShowerAnimatorConfig.colourRandomizer.max),
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.starShowerSettings);
    this.gui.remember(this.settings.starShowerSettings.minSpawnPos);
    this.gui.remember(this.settings.starShowerSettings.maxSpawnPos);
    this.gui.remember(this.settings.starShowerSettings.direction);
  }
  reloadShapeWavesSettings() {
    this.settings.shapeWaveSettings = {
      center: { x: this.shapeWaveAnimatorConfig.center.x, y: this.shapeWaveAnimatorConfig.center.y, z: this.shapeWaveAnimatorConfig.center.z },
      shapeType: this.shapeWaveAnimatorConfig.waveShape,
      waveSpeed: this.shapeWaveAnimatorConfig.waveSpeed,
      waveGap: this.shapeWaveAnimatorConfig.waveGap,
      colourPalette: this.shapeWaveAnimatorConfig.colourPalette,
      brightness: this.shapeWaveAnimatorConfig.brightness,
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.shapeWaveSettings);
    this.gui.remember(this.settings.shapeWaveSettings.center);
  }
  reloadGameOfLifeSettings() {
    this.settings.gameOfLifeSettings = {
      seed: this.gameOfLifeAnimatorConfig.seed,
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.gameOfLifeSettings);
  }
  reloadFireSettings() {
    this.settings.fireSettings = {...this.fireAnimatorConfig,
      reset: this.resetDisplay.bind(this),
    };
    this.gui.remember(this.settings.fireSettings);
  }
  reloadSceneSettings() {
    this.settings.sceneSettings = {
      sceneType: this.sceneAnimatorConfig.sceneType,
      simpleSceneOptions: {...simpleSceneDefaultOptions,
        ambientLightColour: THREEColorToGuiColor(simpleSceneDefaultOptions.ambientLightColour),
        pointLight1Colour: THREEColorToGuiColor(simpleSceneDefaultOptions.pointLight1Colour),
        pointLight2Colour: THREEColorToGuiColor(simpleSceneDefaultOptions.pointLight2Colour),
        pointLight3Colour: THREEColorToGuiColor(simpleSceneDefaultOptions.pointLight3Colour),
        sphereColour: THREEColorToGuiColor(simpleSceneDefaultOptions.sphereColour),
        wallColour: THREEColorToGuiColor(simpleSceneDefaultOptions.wallColour),
      },
      shadowSceneOptions: {...shadowSceneDefaultOptions,
        ambientLightColour: THREEColorToGuiColor(shadowSceneDefaultOptions.ambientLightColour),
        pointLightColour: THREEColorToGuiColor(shadowSceneDefaultOptions.pointLightColour),
      },
      fogSceneOptions: {...fogSceneDefaultOptions,
        fogColour: THREEColorToGuiColor(fogSceneDefaultOptions.fogColour),
        ambientLightColour: THREEColorToGuiColor(fogSceneDefaultOptions.ambientLightColour),
        pointLightColour: THREEColorToGuiColor(fogSceneDefaultOptions.pointLightColour),
      },
    };
    this.gui.remember(this.settings.sceneSettings);
    this.gui.remember(this.settings.sceneSettings.sceneType);
    this.gui.remember(this.settings.sceneSettings.simpleSceneOptions);
    this.gui.remember(this.settings.sceneSettings.shadowSceneOptions);
    this.gui.remember(this.settings.sceneSettings.fogSceneOptions);
  }
  reloadAudioVisSettings() {
    this.settings.audioVisSettings = {...this.soundVizAnimatorConfig,
      showDebug: this.soundController.showDebug,
      basicBarsAudioVisSettings: {...basicBarsAudioVisDefaultConfig,
        lowColour: THREEColorToGuiColor(basicBarsAudioVisDefaultConfig.lowColour),
        highColour: THREEColorToGuiColor(basicBarsAudioVisDefaultConfig.highColour),
      },
      historyBarsAudioVisSettings: {...historyBarsAudioVisDefaultConfig,
        lowColour: THREEColorToGuiColor(historyBarsAudioVisDefaultConfig.lowColour),
        highColour: THREEColorToGuiColor(historyBarsAudioVisDefaultConfig.highColour),
      },
      fireSettings: {...fireAudioVisDefaultConfig,
        lowTempColour: THREEColorToGuiColor(fireAudioVisDefaultConfig.lowTempColour),
        highTempColour: THREEColorToGuiColor(fireAudioVisDefaultConfig.highTempColour),
      },
    };
    this.gui.remember(this.settings.audioVisSettings);
    this.gui.remember(this.settings.audioVisSettings.basicBarsAudioVisSettings);
    this.gui.remember(this.settings.audioVisSettings.historyBarsAudioVisSettings);
    this.gui.remember(this.settings.audioVisSettings.fireSettings);
  }

  reloadSettings() {
    this.settings = {...this.settings,
      animatorType: VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR,
      showWireFrame: this.voxelDisplay.outlinesEnabled,
      orbitMode: this.voxelDisplay.orbitModeEnabled,
      crossfadeTime: DEFAULT_CROSSFADE_TIME_SECS,
    };

    this.reloadVoxelColourSettings();
    this.reloadStarShowerSettings();
    this.reloadShapeWavesSettings();
    this.reloadGameOfLifeSettings();
    this.reloadFireSettings();
    this.reloadSceneSettings();
    this.reloadAudioVisSettings();

    this.gui.remember(this.settings);
  }

  updateAnimator(animatorType, config) {
    
    switch (animatorType) {

      case VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR:
        this.colourAnimatorConfig = config;
        this.reloadVoxelColourSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER:
        this.starShowerAnimatorConfig = config;
        this.reloadStarShowerSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES:
        this.shapeWaveAnimatorConfig = config;
        this.reloadShapeWavesSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_TYPE_GAME_OF_LIFE:
        this.gameOfLifeAnimatorConfig = config;
        this.reloadGameOfLifeSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_FIRE:
        this.fireAnimatorConfig = config;
        this.reloadFireSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_SCENE:
        this.sceneAnimatorConfig = config;
        this.reloadSceneSettings();
        break;
      case VoxelAnimator.VOXEL_ANIM_SOUND_VIZ:
        this.soundVizAnimatorConfig = config;
        this.reloadAudioVisSettings();
        break;

      default:
        console.error("Animator type Not implemented!");
        break;
    }
    this.animatorTypeController.setValue(animatorType);
  }

  buildVoxelColourControls() {
    const {voxelColourSettings} = this.settings;
  
    const folder = this.gui.addFolder("Colour Change Controls");
   
    folder.add(voxelColourSettings, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES).onChange((value) => {
      this.colourAnimatorConfig.colourInterpolationType = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.colourInterpolationType);
    
    folder.add(voxelColourSettings, 'interpolationType', INTERPOLATION_TYPES).onChange((value) => {
      this.colourAnimatorConfig.interpolationType = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.interpolationType);

    folder.addColor(voxelColourSettings, 'colourStart').onChange((value) => {
      this.colourAnimatorConfig.colourStart = GuiColorToRGBObj(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.colourStart);
    
    folder.addColor(voxelColourSettings, 'colourEnd').onChange((value) => {
      this.colourAnimatorConfig.colourEnd = GuiColorToRGBObj(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.colourEnd);
    
    folder.add(voxelColourSettings, 'startTimeSecs', 0.0, 30.0, 0.1).onChange((value) => {
      this.colourAnimatorConfig.startTimeSecs = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.startTimeSecs);
    
    folder.add(voxelColourSettings, 'endTimeSecs', 0.0, 30.0, 0.1).onChange((value) => {
      this.colourAnimatorConfig.endTimeSecs = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
    }).setValue(voxelColourSettings.endTimeSecs);
    
    folder.add(voxelColourSettings, 'reset');

    const {voxelDisplay} = this.voxelClient;
    folder.add(voxelColourSettings, 'shapeType', VOXEL_COLOUR_SHAPE_TYPES).onChange((value) => {

      if (this.shapeSettingsFolder) {
        folder.removeFolder(this.shapeSettingsFolder);
        this.shapeSettingsFolder = null;
      }

      switch (value) {
        case VOXEL_COLOUR_SHAPE_TYPE_ALL:
          this.colourAnimatorConfig.voxelPositions = voxelDisplay.voxelIndexList();
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
          this.voxelClient.sendClearCommand(0,0,0);
          break;

        case VOXEL_COLOUR_SHAPE_TYPE_SPHERE: {
          this.shapeSettingsFolder = folder.addFolder("Sphere Properties");

          this.shapeSettingsFolder.add(voxelColourSettings.sphereProperties, 'fill').onChange((value) => {
            this.colourAnimatorConfig.voxelPositions = voxelDisplay.voxelSphereList(
              new THREE.Vector3(
                voxelColourSettings.sphereProperties.center.x,
                voxelColourSettings.sphereProperties.center.y,
                voxelColourSettings.sphereProperties.center.z
              ),
              voxelColourSettings.sphereProperties.radius, value
            );

            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);

          }).setValue(voxelColourSettings.sphereProperties.fill);

          this.shapeSettingsFolder.add(voxelColourSettings.sphereProperties, 'radius', 0.5, voxelDisplay.gridSize, 0.5).onChange((value) => {
            
            this.colourAnimatorConfig.voxelPositions = voxelDisplay.voxelSphereList(
              new THREE.Vector3(
                voxelColourSettings.sphereProperties.center.x,
                voxelColourSettings.sphereProperties.center.y,
                voxelColourSettings.sphereProperties.center.z
              ), value, voxelColourSettings.sphereProperties.fill
            );

            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);

          }).setValue(voxelColourSettings.sphereProperties.radius);

          const onChangeSphereCenter = (value, component) => {
            const newCenter = new THREE.Vector3(voxelColourSettings.sphereProperties.center.x,voxelColourSettings.sphereProperties.center.y,voxelColourSettings.sphereProperties.center.z);
            newCenter[component] = value;
            this.colourAnimatorConfig.voxelPositions = voxelDisplay.voxelSphereList(newCenter, voxelColourSettings.sphereProperties.radius, voxelColourSettings.sphereProperties.fill);
            
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);
          };

          const centerFolder = this.shapeSettingsFolder.addFolder("Center");
          const voxelGridSize = voxelDisplay.gridSize;
          centerFolder.add(voxelColourSettings.sphereProperties.center, 'x', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeSphereCenter(value, 'x');
          }).setValue(voxelColourSettings.sphereProperties.center.x);
          centerFolder.add(voxelColourSettings.sphereProperties.center, 'y', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeSphereCenter(value, 'y');
          }).setValue(voxelColourSettings.sphereProperties.center.y);
          centerFolder.add(voxelColourSettings.sphereProperties.center, 'z', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeSphereCenter(value, 'z');
          }).setValue(voxelColourSettings.sphereProperties.center.z);
          centerFolder.open();

          this.shapeSettingsFolder.open();
          
          break;
        }

        case VOXEL_COLOUR_SHAPE_TYPE_BOX: {
          const buildBoxPts = (currBoxProperties) => {
            const halfWidth = currBoxProperties.width/2.0;
            const halfHeight = currBoxProperties.height/2.0;
            const halfDepth = currBoxProperties.depth/2.0;

            return voxelDisplay.voxelBoxList(
              new THREE.Vector3(
                currBoxProperties.center.x-halfWidth,
                currBoxProperties.center.y-halfHeight,
                currBoxProperties.center.z-halfDepth
              ), 
              new THREE.Vector3(
                currBoxProperties.center.x+halfWidth,
                currBoxProperties.center.y+halfHeight,
                currBoxProperties.center.z+halfDepth,
              ), currBoxProperties.fill 
            );
          };

          const onChangeBasicBoxProperty = (value, property) => {
            this.colourAnimatorConfig.voxelPositions = buildBoxPts({...voxelColourSettings.boxProperties, [property]:value});
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);
          };
          const onChangeBoxCenter = (value, component) => {
            const newCenter = new THREE.Vector3(voxelColourSettings.boxProperties.center.x,voxelColourSettings.boxProperties.center.y,voxelColourSettings.boxProperties.center.z);
            newCenter[component] = value;
            this.colourAnimatorConfig.voxelPositions = buildBoxPts({...voxelColourSettings.boxProperties, center:newCenter});
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR, this.colourAnimatorConfig);
            this.voxelClient.sendClearCommand(0,0,0);
          };

          this.shapeSettingsFolder = folder.addFolder("Box Properties");
          this.shapeSettingsFolder.add(voxelColourSettings.boxProperties, 'fill').onChange((value) => {
            onChangeBasicBoxProperty(value, 'fill');
          }).setValue(voxelColourSettings.boxProperties.fill);

          const dimensionsFolder = this.shapeSettingsFolder.addFolder("Dimensions");
          const voxelGridSize = voxelDisplay.gridSize;
          dimensionsFolder.add(voxelColourSettings.boxProperties, 'width', 0.5, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBasicBoxProperty(value, 'width');
          }).setValue(voxelColourSettings.boxProperties.width);
          dimensionsFolder.add(voxelColourSettings.boxProperties, 'height', 0.5, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBasicBoxProperty(value, 'height');
          }).setValue(voxelColourSettings.boxProperties.height);
          dimensionsFolder.add(voxelColourSettings.boxProperties, 'depth', 0.5, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBasicBoxProperty(value, 'depth');
          }).setValue(voxelColourSettings.boxProperties.depth);
          dimensionsFolder.open();

          const centerFolder = this.shapeSettingsFolder.addFolder("Center");
          centerFolder.add(voxelColourSettings.boxProperties.center, 'x', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBoxCenter(value, 'x');
          }).setValue(voxelColourSettings.boxProperties.center.x);
          centerFolder.add(voxelColourSettings.boxProperties.center, 'y', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBoxCenter(value, 'y');
          }).setValue(voxelColourSettings.boxProperties.center.y);
          centerFolder.add(voxelColourSettings.boxProperties.center, 'z', -voxelGridSize, 2*voxelGridSize, 0.5).onChange((value) => {
            onChangeBoxCenter(value, 'z');
          }).setValue(voxelColourSettings.boxProperties.center.z);
          centerFolder.open();
          
          this.shapeSettingsFolder.open();
          break;
        }
        default:
          break;
      }
    }).setValue(voxelColourSettings.shapeType);
  
    folder.open();
    return folder;
  }

  buildStarShowerAnimatorControls() {
    const {starShowerSettings} = this.settings;

    const folder = this.gui.addFolder("Star Shower Controls");
    folder.add(starShowerSettings, 'spawnRate', 0.25, 50.0, 0.25).onChange((value) => {
      this.starShowerAnimatorConfig.spawnRate = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      //this.voxelClient.sendClearCommand(0,0,0);
    }).setValue(starShowerSettings.spawnRate);

    
    folder.addColor(starShowerSettings, 'colourMin').onChange((value) => {
      const currRandomizer = this.starShowerAnimatorConfig.colourRandomizer;
      currRandomizer.min = GuiColorToRGBObj(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      //this.voxelClient.sendClearCommand(0,0,0);
    }).setValue(starShowerSettings.colourMin);

    folder.addColor(starShowerSettings, 'colourMax').onChange((value) => {
      const currRandomizer = this.starShowerAnimatorConfig.colourRandomizer;
      currRandomizer.max = GuiColorToRGBObj(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      //this.voxelClient.sendClearCommand(0,0,0);
    }).setValue(starShowerSettings.colourMax);

    const onChangeSpd = (value, component) => {
      const currRandomizer = this.starShowerAnimatorConfig.speedRandomizer;
      currRandomizer[component] = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);

    };
    folder.add(starShowerSettings, 'speedMin', 1, 25.0, 0.5).onChange((value) => {
      const actualVal = Math.min(value, starShowerSettings.speedMax);
      onChangeSpd(actualVal, 'min');
      starShowerSettings.speedMin = actualVal;
    }).setValue(starShowerSettings.speedMin);
    folder.add(starShowerSettings, 'speedMax', 1, 25.0, 0.5).onChange((value) => {
      const actualVal = Math.max(value, starShowerSettings.speedMin);
      onChangeSpd(actualVal, 'max');
      starShowerSettings.speedMax = actualVal;
    }).setValue(starShowerSettings.speedMax);

    folder.add(starShowerSettings, 'directionVariance', 0, Math.PI, Math.PI/16).onChange((value) => {
      const currRandomizer = this.starShowerAnimatorConfig.directionRandomizer;
      currRandomizer.radAngle = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
    }).setValue(starShowerSettings.directionVariance);

    const onChangeDir = (value, component) => {
      const currRandomizer = this.starShowerAnimatorConfig.directionRandomizer;
      currRandomizer.baseDirection = new THREE.Vector3(starShowerSettings.direction.x, starShowerSettings.direction.y, starShowerSettings.direction.z);
      currRandomizer.baseDirection[component] = value;
      currRandomizer.baseDirection.normalize();
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
    };
    const dirFolder = folder.addFolder("Direction");
    dirFolder.add(starShowerSettings.direction, 'x', -1, 1, 0.01).onChange((value) => {
      onChangeDir(value, 'x');
    }).setValue(starShowerSettings.direction.x);
    dirFolder.add(starShowerSettings.direction, 'y', -1, 1, 0.01).onChange((value) => {
      onChangeDir(value, 'y');
    }).setValue(starShowerSettings.direction.y);
    dirFolder.add(starShowerSettings.direction, 'z', -1, 1, 0.01).onChange((value) => {
      onChangeDir(value, 'z');
    }).setValue(starShowerSettings.direction.z);
    dirFolder.open();
    
    
    const onChangePositionMin = (value, component) => {
      const actualVal = Math.min(value, starShowerSettings.maxSpawnPos[component]);
      const currRandomizer = this.starShowerAnimatorConfig.positionRandomizer;
      currRandomizer.min[component] = actualVal;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      starShowerSettings.minSpawnPos[component] = actualVal;
    };
    const onChangePositionMax = (value, component) => {
      const actualVal = Math.max(value, starShowerSettings.minSpawnPos[component]);
      const currRandomizer = this.starShowerAnimatorConfig.positionRandomizer;
      currRandomizer.max[component] = actualVal;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER, this.starShowerAnimatorConfig);
      starShowerSettings.maxSpawnPos[component] = actualVal;
    };

    const positionXMax = 2*this.voxelClient.voxelDisplay.xSize();
    const positionYMax = 2*this.voxelClient.voxelDisplay.ySize();
    const positionZMax = 2*this.voxelClient.voxelDisplay.zSize();

    const posFolder = folder.addFolder("Position Spawning");
    const minPosFolder = posFolder.addFolder("Min");
    minPosFolder.add(starShowerSettings.minSpawnPos, 'x', -positionXMax, positionXMax, 1).onChange((value) => {
      onChangePositionMin(value, 'x');
    }).setValue(starShowerSettings.minSpawnPos.x);
    minPosFolder.add(starShowerSettings.minSpawnPos, 'y', -positionYMax, positionYMax, 1).onChange((value) => {
      onChangePositionMin(value, 'y');
    }).setValue(starShowerSettings.minSpawnPos.y);
    minPosFolder.add(starShowerSettings.minSpawnPos, 'z', -positionZMax, positionZMax, 1).onChange((value) => {
      onChangePositionMin(value, 'z');
    }).setValue(starShowerSettings.minSpawnPos.z);
    minPosFolder.open();

    const maxPosFolder = posFolder.addFolder("Max");
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'x', -positionXMax, positionXMax, 1).onChange((value) => {
      onChangePositionMax(value, 'x');
    }).setValue(starShowerSettings.maxSpawnPos.x);
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'y', -positionYMax, positionYMax, 1).onChange((value) => {
      onChangePositionMax(value, 'y');
    }).setValue(starShowerSettings.maxSpawnPos.y);
    maxPosFolder.add(starShowerSettings.maxSpawnPos, 'z', -positionZMax, positionZMax, 1).onChange((value) => {
      onChangePositionMax(value, 'z');
    }).setValue(starShowerSettings.maxSpawnPos.z);

    maxPosFolder.open();
    posFolder.open();
   
    folder.add(starShowerSettings, 'reset');
    folder.open();

    return folder;
  }
  
  buildShapeWavesAnimatorControls() {
    const {shapeWaveSettings} = this.settings;

    const folder = this.gui.addFolder("Shape Wave Controls");

    folder.add(shapeWaveSettings, 'waveSpeed', 0.5, 25.0, 0.5).onChange((value) => {
      this.shapeWaveAnimatorConfig.waveSpeed = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    }).setValue(shapeWaveSettings.waveSpeed);

    folder.add(shapeWaveSettings, 'waveGap', 0.0, 25.0, 1).onChange((value) => {
      this.shapeWaveAnimatorConfig.waveGap = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    }).setValue(shapeWaveSettings.waveGap);

    folder.add(shapeWaveSettings, 'brightness', 0, 1, 1/256).onChange((value) => {
      this.shapeWaveAnimatorConfig.brightness = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    }).setValue(shapeWaveSettings.brightness);


    folder.add(shapeWaveSettings, 'shapeType', WAVE_SHAPE_TYPES).onChange((value) => {
      this.shapeWaveAnimatorConfig.waveShape = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    }).setValue(shapeWaveSettings.shapeType);

    const onChangeWaveCenter = (value, component) => {
      this.shapeWaveAnimatorConfig.center[component] = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_SHAPE_WAVES, this.shapeWaveAnimatorConfig);
    };

    const centerFolder = folder.addFolder("Center");

    const voxelGridSizeX = this.voxelClient.voxelDisplay.xSize();
    const voxelGridSizeY = this.voxelClient.voxelDisplay.ySize();
    const voxelGridSizeZ = this.voxelClient.voxelDisplay.zSize();

    centerFolder.add(shapeWaveSettings.center, 'x', -voxelGridSizeX, 2*voxelGridSizeX, 0.5).onChange((value) => {
      onChangeWaveCenter(value, 'x');
    }).setValue(shapeWaveSettings.center.x);
    centerFolder.add(shapeWaveSettings.center, 'y', -voxelGridSizeY, 2*voxelGridSizeY, 0.5).onChange((value) => {
      onChangeWaveCenter(value, 'y');
    }).setValue(shapeWaveSettings.center.y);
    centerFolder.add(shapeWaveSettings.center, 'z', -voxelGridSizeZ, 2*voxelGridSizeZ, 0.5).onChange((value) => {
      onChangeWaveCenter(value, 'z');
    }).setValue(shapeWaveSettings.center.z);
    centerFolder.open();

 
    //const paletteFolder = folder.addFolder("Colour Palette");
    //shapeWaveSettings.colourPalette.forEach((colour, idx) => {
    //  paletteFolder.addColor(shapeWaveSettings.colourPalette, idx).onChange((value) => {
    //  }).setValue(value);
    //});

    folder.add(shapeWaveSettings, 'reset');
    folder.open();

    return folder;
  }

  buildGameOfLifeAnimatorControls() {
    const {gameOfLifeSettings} = this.settings;

    const folder = this.gui.addFolder("Game of Life Controls");

    folder.add(gameOfLifeSettings, 'seed').onChange((value) => {
      this.gameOfLifeAnimatorConfig.seed = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_TYPE_GAME_OF_LIFE, this.gameOfLifeAnimatorConfig);
    });

    folder.add(gameOfLifeSettings, 'reset');
    folder.open();

    return folder;
  }

  buildFireAnimatorControls() {
    const {fireSettings} = this.settings;
    const folder = this.gui.addFolder("Fire Controls");

    folder.add(fireSettings, 'speed', 0.1, 5.0, 0.1).onChange((value) => {
      this.fireAnimatorConfig.speed = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.speed);

    folder.add(fireSettings, 'diffusion', 0.00001, 1.0, 0.0001).onChange((value) => {
      this.fireAnimatorConfig.diffusion = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.diffusion);

    folder.add(fireSettings, 'viscosity', 0.0, 0.001, 0.00001).onChange((value) => {
      this.fireAnimatorConfig.viscosity = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.viscosity);

    folder.add(fireSettings, 'buoyancy', 0.1, 10, 0.1).onChange((value) => {
      this.fireAnimatorConfig.buoyancy = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.buoyancy);

    folder.add(fireSettings, 'cooling', 0.1, 1.5, 0.01).onChange((value) => {
      this.fireAnimatorConfig.cooling = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.cooling);

    folder.add(fireSettings, 'vorticityConfinement', 1, 20, 1).onChange((value) => {
      this.fireAnimatorConfig.vorticityConfinement = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.vorticityConfinement);

    folder.add(fireSettings, 'initialIntensityMultiplier', 0.1, 10, 0.1).onChange((value) => {
      this.fireAnimatorConfig.initialIntensityMultiplier = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.initialIntensityMultiplier);

    folder.add(fireSettings, 'spectrumTempMin', 0, 5000, 100).onChange((value) => {
      this.fireAnimatorConfig.spectrumTempMin = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.spectrumTempMin);

    folder.add(fireSettings, 'spectrumTempMax', 0, 30000, 100).onChange((value) => {
      this.fireAnimatorConfig.spectrumTempMax = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.spectrumTempMax);

    folder.add(fireSettings, 'colourSystem', Object.keys(ColourSystems)).onChange((value) => {
      this.fireAnimatorConfig.colourSystem = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
    }).setValue(fireSettings.colourSystem);

    folder.add(fireSettings, 'reset');
    folder.open();

    return folder;
  }

  buildSceneAnimatorControls() {
    
    const {sceneSettings} = this.settings;
    
    const folder = this.gui.addFolder("Scene Controls");

    folder.add(sceneSettings, 'sceneType', SCENE_TYPES).onChange((value) => {
      
      if (this.sceneSettingsFolder) {
        folder.removeFolder(this.sceneSettingsFolder);
        this.sceneSettingsFolder = null;
      }

      this.sceneSettingsFolder = folder.addFolder(value + " Settings");
      let sceneTypeOptions = null;
      
      this.sceneAnimatorConfig.sceneType = value;
      switch (value) {
        case SCENE_TYPE_SIMPLE:
          sceneTypeOptions = sceneSettings.simpleSceneOptions;
          this.sceneAnimatorConfig.sceneOptions = {...sceneTypeOptions};
          
          this.sceneSettingsFolder.add(sceneTypeOptions, 'sphereRadius', 0.5, 5, 0.25).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.sphereRadius = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.sphereRadius);
          this.sceneSettingsFolder.addColor(sceneTypeOptions, 'sphereColour').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.sphereColour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.sphereColour);
          this.sceneSettingsFolder.addColor(sceneTypeOptions, 'wallColour').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.wallColour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.wallColour);

          this.sceneSettingsFolder.add(sceneTypeOptions, 'wallX').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.wallX = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.wallX);
          this.sceneSettingsFolder.add(sceneTypeOptions, 'wallY').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.wallY = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.wallY);
          this.sceneSettingsFolder.add(sceneTypeOptions, 'wallZ').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.wallZ = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.wallZ);

          this.sceneSettingsFolder.add(sceneTypeOptions, 'textureFilename').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.textureFilename = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.textureFilename);

          this.sceneSettingsFolder.add(sceneTypeOptions, 'pointLightsSpd', 0, Math.PI*6, Math.PI/6).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightsSpd = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightsSpd);
          
          this.sceneSettingsFolder.addColor(sceneTypeOptions, 'pointLight1Colour').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLight1Colour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLight1Colour);
          this.sceneSettingsFolder.addColor(sceneTypeOptions, 'pointLight2Colour').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLight2Colour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLight2Colour);
          this.sceneSettingsFolder.addColor(sceneTypeOptions, 'pointLight3Colour').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLight3Colour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLight3Colour);

          const pointLightAttenFolder = this.sceneSettingsFolder.addFolder("Point Light Attenuation");
          pointLightAttenFolder.add(sceneTypeOptions.pointLightAtten, 'quadratic', 0, 2, 0.001).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightAtten.quadratic = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightAtten.quadratic);
          pointLightAttenFolder.add(sceneTypeOptions.pointLightAtten, 'linear', 0, 4, 0.001).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightAtten.linear = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightAtten.linear);
          pointLightAttenFolder.open();

          break;

        case SCENE_TYPE_SHADOW: {
          sceneTypeOptions = sceneSettings.shadowSceneOptions;
          this.sceneAnimatorConfig.sceneOptions = {...sceneTypeOptions};
          
          
          const boxSizeFolder = this.sceneSettingsFolder.addFolder("Moving Box Size");
          boxSizeFolder.add(sceneTypeOptions.movingBoxSize, 'x', 0.5, 5, 0.25).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.movingBoxSize.x = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.movingBoxSize.x);
          boxSizeFolder.add(sceneTypeOptions.movingBoxSize, 'y', 0.5, 5, 0.25).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.movingBoxSize.y = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.movingBoxSize.y);
          boxSizeFolder.add(sceneTypeOptions.movingBoxSize, 'z', 0.5, 5, 0.25).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.movingBoxSize.z = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.movingBoxSize.z);
          boxSizeFolder.open();

          this.sceneSettingsFolder.add(sceneTypeOptions, 'movingBoxSpeed', 0, 4*Math.PI, 0.1).onChange(value => {
            this.sceneAnimatorConfig.sceneOptions.movingBoxSpeed = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.movingBoxSpeed);

          const pointLightPosFolder = this.sceneSettingsFolder.addFolder("Point Light Position");
          pointLightPosFolder.add(sceneTypeOptions.pointLightPosition, 'x', 0, this.voxelDisplay.xSize(), 1).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightPosition.x = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightPosition.x);
          pointLightPosFolder.add(sceneTypeOptions.pointLightPosition, 'y', 0, this.voxelDisplay.ySize(), 1).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightPosition.y = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightPosition.y);
          pointLightPosFolder.add(sceneTypeOptions.pointLightPosition, 'z', 0, this.voxelDisplay.zSize(), 1).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightPosition.z = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightPosition.z);
          pointLightPosFolder.open();

          this.sceneSettingsFolder.addColor(sceneTypeOptions, 'pointLightColour').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightColour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightColour);

          const pointLightAttenFolder = this.sceneSettingsFolder.addFolder("Point Light Attenuation");
          pointLightAttenFolder.add(sceneTypeOptions.pointLightAtten, 'quadratic', 0, 1, 0.001).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightAtten.quadratic = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightAtten.quadratic);
          pointLightAttenFolder.add(sceneTypeOptions.pointLightAtten, 'linear', 0, 2, 0.001).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightAtten.linear = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightAtten.linear);
          pointLightAttenFolder.open();

          break;
        }

        case SCENE_TYPE_FOG: {
          sceneTypeOptions = sceneSettings.fogSceneOptions;
          this.sceneAnimatorConfig.sceneOptions = {...sceneTypeOptions};

          this.sceneSettingsFolder.add(sceneTypeOptions, 'fogScattering', 0, 1, 0.01).onChange(value => {
            this.sceneAnimatorConfig.sceneOptions.fogScattering = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.fogScattering);

          this.sceneSettingsFolder.addColor(sceneTypeOptions, 'fogColour').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.fogColour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.fogColour);

          const pointLightAttenFolder = this.sceneSettingsFolder.addFolder("Point Light Attenuation");
          pointLightAttenFolder.add(sceneTypeOptions.pointLightAtten, 'quadratic', 0, 1, 0.001).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightAtten.quadratic = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightAtten.quadratic);
          pointLightAttenFolder.add(sceneTypeOptions.pointLightAtten, 'linear', 0, 2, 0.001).onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightAtten.linear = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightAtten.linear);
          pointLightAttenFolder.open();

          this.sceneSettingsFolder.addColor(sceneTypeOptions, 'pointLightColour').onChange((value) => {
            this.sceneAnimatorConfig.sceneOptions.pointLightColour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
          }).setValue(sceneTypeOptions.pointLightColour);



          break;
        }

        default:
          break;
      }

      if (sceneTypeOptions && sceneTypeOptions.ambientLightColour) {
        this.sceneSettingsFolder.addColor(sceneTypeOptions, 'ambientLightColour').onChange((value) => {
          this.sceneAnimatorConfig.sceneOptions.ambientLightColour = GuiColorToRGBObj(value);
          this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
        }).setValue(sceneTypeOptions.ambientLightColour);
      }

      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SCENE, this.sceneAnimatorConfig);
      
      this.sceneSettingsFolder.open();
    }).setValue(sceneSettings.sceneType);

    folder.open();

    return folder;
  }

  buildSoundVizAnimatorControls() {
    const {audioVisSettings: soundVizSettings} = this.settings;
    const folder = this.gui.addFolder("Sound Viz Controls");
    /*
    folder.add(soundVizSettings, 'numFFTSamples', 1, 32, 1).onChange((value) => {
      this.soundVizAnimatorConfig.numFFTSamples = value;
      this.soundController.setFFTNumSamples(value);
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
    }).setValue(soundVizSettings.numFFTSamples);
    */
    folder.add(soundVizSettings, 'levelMax', 0.1, 10, 0.01).onChange((value) => {
      this.soundVizAnimatorConfig.levelMax = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
    }).setValue(soundVizSettings.levelMax);

    folder.add(soundVizSettings, 'gamma', 1, 8, 0.1).onChange((value) => {
      this.soundVizAnimatorConfig.gamma = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
    }).setValue(soundVizSettings.gamma);

    folder.add(soundVizSettings, 'fadeFactor', 0, 0.1, 0.001).onChange((value) => {
      this.soundVizAnimatorConfig.fadeFactor = value;
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
    }).setValue(soundVizSettings.fadeFactor);

    folder.add(soundVizSettings, 'showDebug').onChange((value) => {
      this.soundController.showDebug = value;
    }).setValue(soundVizSettings.showDebug);

    folder.add(soundVizSettings, 'sceneType', SOUND_VIZ_TYPES).onChange((value) => {
      if (this.audioVizSettingsFolder) {

        if (this.audioVizTypeFolder) {
          this.audioVizSettingsFolder.removeFolder(this.audioVizTypeFolder);
          this.audioVizTypeFolder = null;
        }

        folder.removeFolder(this.audioVizSettingsFolder);
        this.audioVizSettingsFolder = null;
      }

      this.audioVizSettingsFolder = folder.addFolder(value + " Settings");
      let vizTypeOptions = null;
      this.soundVizAnimatorConfig.sceneType = value;

      switch (value) {
        case SOUND_VIZ_BASIC_BARS_LEVEL_SCENE_TYPE:
          vizTypeOptions = soundVizSettings.basicBarsAudioVisSettings;
          this.soundVizAnimatorConfig.sceneConfig = {...vizTypeOptions};

          this.audioVizSettingsFolder.addColor(vizTypeOptions, 'lowColour').onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.lowColour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.lowColour);
          this.audioVizSettingsFolder.addColor(vizTypeOptions, 'highColour').onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.highColour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.highColour);
          this.audioVizSettingsFolder.add(vizTypeOptions, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.colourInterpolationType = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.colourInterpolationType);

          this.audioVizSettingsFolder.add(vizTypeOptions, 'splitLevels').onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.splitLevels = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.splitLevels);

          this.audioVizSettingsFolder.add(vizTypeOptions, 'centerSorted').onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.centerSorted = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.centerSorted);

          break;

        case SOUND_VIZ_HISTORY_BARS_LEVEL_SCENE_TYPE:
          vizTypeOptions = soundVizSettings.historyBarsAudioVisSettings;
          this.soundVizAnimatorConfig.sceneConfig = {...vizTypeOptions};

          this.audioVizSettingsFolder.addColor(vizTypeOptions, 'lowColour').onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.lowColour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.lowColour);
          this.audioVizSettingsFolder.addColor(vizTypeOptions, 'highColour').onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.highColour = GuiColorToRGBObj(value);
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.highColour);
          this.audioVizSettingsFolder.add(vizTypeOptions, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.colourInterpolationType = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.colourInterpolationType);

          this.audioVizSettingsFolder.add(vizTypeOptions, 'speed', 1, 20, 0.1).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.speed = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.speed);
          this.audioVizSettingsFolder.add(vizTypeOptions, 'tempoMultiplier', 1, 100, 1).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.tempoMultiplier = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.tempoMultiplier);

          this.audioVizSettingsFolder.add(vizTypeOptions, 'direction', DIRECTION_TYPES).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.direction = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.direction);

          break;

        case SOUND_VIZ_FIRE_SCENE_TYPE:
          vizTypeOptions = soundVizSettings.fireSettings;
          this.soundVizAnimatorConfig.sceneConfig = {...vizTypeOptions};
          
          this.audioVizSettingsFolder.add(vizTypeOptions, 'noise', 0, 1, 0.01).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.noise = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.noise);

          this.audioVizSettingsFolder.add(vizTypeOptions, 'initialIntensityMultiplier', 0.1, 20, 0.1).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.initialIntensityMultiplier = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.initialIntensityMultiplier);

          this.audioVizSettingsFolder.add(vizTypeOptions, 'speedMultiplier', 0.1, 3, 0.01).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.speedMultiplier = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.speedMultiplier);
          this.audioVizSettingsFolder.add(vizTypeOptions, 'coolingMultiplier', 0, 5, 0.1).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.coolingMultiplier = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.coolingMultiplier);
          this.audioVizSettingsFolder.add(vizTypeOptions, 'boyancyMultiplier', 0, 5, 0.1).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.boyancyMultiplier = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.boyancyMultiplier);
          this.audioVizSettingsFolder.add(vizTypeOptions, 'turbulenceMultiplier', 0, 5, 0.1).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.turbulenceMultiplier = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.turbulenceMultiplier);
          
          this.audioVizSettingsFolder.add(vizTypeOptions, 'colourMode', COLOUR_MODES).onChange((value) => {
            if (this.audioVizTypeFolder) {
              this.audioVizSettingsFolder.removeFolder(this.audioVizTypeFolder);
              this.audioVizTypeFolder = null;
            }

            this.audioVizTypeFolder = this.audioVizSettingsFolder.addFolder(value + " Settings");
            this.soundVizAnimatorConfig.sceneConfig.colourMode = value;

            switch (value) {
              case TEMPERATURE_COLOUR_MODE:
                this.audioVizTypeFolder.add(vizTypeOptions, 'temperatureMin', 0, 5000, 100).onChange((value) => {
                  this.soundVizAnimatorConfig.sceneConfig.temperatureMin = value;
                  this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_FIRE, this.fireAnimatorConfig);
                }).setValue(vizTypeOptions.temperatureMin);

                this.audioVizTypeFolder.add(vizTypeOptions, 'temperatureMax', 0, 8000, 100).onChange((value) => {
                  this.soundVizAnimatorConfig.sceneConfig.temperatureMax = value;
                  this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
                }).setValue(vizTypeOptions.temperatureMax);
                break;

              case RANDOM_COLOUR_MODE:
                this.audioVizTypeFolder.add(vizTypeOptions, 'randomColourHoldTime', 0.1, 60, 0.1).onChange((value) => {
                  this.soundVizAnimatorConfig.sceneConfig.randomColourHoldTime = value;
                  this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
                }).setValue(vizTypeOptions.randomColourHoldTime);
                this.audioVizTypeFolder.add(vizTypeOptions, 'randomColourTransitionTime', 0.1, 60, 0.1).onChange((value) => {
                  this.soundVizAnimatorConfig.sceneConfig.randomColourTransitionTime = value;
                  this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
                }).setValue(vizTypeOptions.randomColourTransitionTime);
                break;
              
              case LOW_HIGH_TEMP_COLOUR_MODE:
              default:
                this.audioVizTypeFolder.addColor(vizTypeOptions, 'lowTempColour').onChange((value) => {
                  this.soundVizAnimatorConfig.sceneConfig.lowTempColour = GuiColorToRGBObj(value);
                  this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
                }).setValue(vizTypeOptions.lowTempColour);
                this.audioVizTypeFolder.addColor(vizTypeOptions, 'highTempColour').onChange((value) => {
                  this.soundVizAnimatorConfig.sceneConfig.highTempColour = GuiColorToRGBObj(value);
                  this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
                }).setValue(vizTypeOptions.highTempColour);
                break;
            }

            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
            this.audioVizTypeFolder.open();

          }).setValue(vizTypeOptions.colourMode);

          this.audioVizSettingsFolder.add(vizTypeOptions, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.colourInterpolationType = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.colourInterpolationType);
        
          this.audioVizSettingsFolder.add(vizTypeOptions, 'colourGamma', 1, 5, 0.1).onChange((value) => {
            this.soundVizAnimatorConfig.sceneConfig.colourGamma = value;
            this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
          }).setValue(vizTypeOptions.colourGamma);
          

          break;

        default:
          break;
      }
      
      this.voxelClient.sendAnimatorChangeCommand(VoxelAnimator.VOXEL_ANIM_SOUND_VIZ, this.soundVizAnimatorConfig);
      this.audioVizSettingsFolder.open();

    }).setValue(soundVizSettings.sceneType);


    folder.open();

    return folder;
  }

}

export default ControlPanel;