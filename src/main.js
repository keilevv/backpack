import './style.css'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'
import { createColorPicker } from './sidebar.js'

// Set up the scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a1a)

// Set up the camera
// Set up the camera
const container = document.querySelector('#app')
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight, // Initial aspect ratio, will be updated
  0.1,
  1000
)
camera.position.set(0, 0, 5)

// Set up the renderer
// Set up the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(container.clientWidth, container.clientHeight)
renderer.shadowMap.enabled = true
container.appendChild(renderer.domElement)

// Add orbit controls for interaction
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05

// Create transform controls for sticker manipulation
// Note: TransformControls must be added to the scene to work properly
let transformControls = null

// Initialize transform controls after renderer is set up
function initTransformControls() {
  try {
    transformControls = new TransformControls(camera, renderer.domElement)
    transformControls.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value
    })
    
    // TransformControls in some Three.js versions may not properly extend Object3D
    // or may have issues being added to the scene. We'll use it without adding to scene.
    // The gizmos are rendered through the domElement, so it should still work.
    // If you need it in the scene, uncomment the line below, but it may cause the error.
    // scene.add(transformControls)
    
    console.log('TransformControls initialized (not added to scene to avoid compatibility issues)')
  } catch (error) {
    console.error('Failed to initialize TransformControls:', error)
  }
}

// Initialize immediately - TransformControls should work right away
initTransformControls()

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(5, 10, 5)
directionalLight.castShadow = true
scene.add(directionalLight)

const pointLight = new THREE.PointLight(0xffffff, 0.5)
pointLight.position.set(-5, 5, -5)
scene.add(pointLight)

// Store reference to backpack object for color updates
let backpackObject = null
const backpackMeshes = []
const textureLoader = new THREE.TextureLoader()

// Sticker system
const stickers = [] // Array to store all sticker objects
let selectedSticker = null
let raycaster = new THREE.Raycaster()
let mouse = new THREE.Vector2()
let isDragging = false
let isPlacingSticker = false
let pendingStickerData = null

// Function to update backpack color
function updateBackpackColor(color) {
  const threeColor = new THREE.Color(color)
  backpackMeshes.forEach((mesh) => {
    if (mesh.material) {
      // Handle both single material and material arrays
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => {
          if (mat) {
            mat.color.copy(threeColor)
            // Keep existing textures, just update the base color
            if (mat.map) {
              mat.needsUpdate = true
            }
          }
        })
      } else {
        mesh.material.color.copy(threeColor)
        // Keep existing textures, just update the base color
        if (mesh.material.map) {
          mesh.material.needsUpdate = true
        }
      }
    }
  })
}

// Store callbacks
let onStickerCreated = null
let onStickerSelected = null

// Function to create a decal on the mesh surface
function createSticker(imageUrl, imageName, position, normal, targetMesh) {
  textureLoader.load(
    imageUrl,
    (texture) => {
      // Configure texture - flip Y to fix orientation
      texture.flipY = true
      
      // Default decal size
      const stickerSize = 0.3
      const decalSize = new THREE.Vector3(stickerSize, stickerSize, stickerSize)
      
      // Create orientation for the decal (aligned to surface normal)
      const up = new THREE.Vector3(0, 1, 0)
      const quaternion = new THREE.Quaternion()
      quaternion.setFromUnitVectors(up, normal)
      
      // Create decal geometry
      const decalGeometry = new DecalGeometry(
        targetMesh,
        position,
        normal,
        decalSize,
        quaternion
      )
      
      // Create material with the texture
      const material = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        wireframe: false
      })
      
      // Create the decal mesh
      const decal = new THREE.Mesh(decalGeometry, material)
      
      // Store sticker data
      const stickerData = {
        mesh: decal,
        geometry: decalGeometry,
        texture: texture,
        material: material,
        name: imageName,
        url: imageUrl,
        size: stickerSize,
        position: position.clone(),
        normal: normal.clone(),
        targetMesh: targetMesh,
        rotation: 0, // Rotation angle in degrees
        outline: null // Outline helper for selection
      }
      
      stickers.push(stickerData)
      scene.add(decal)
      
      // Select the newly created sticker
      selectSticker(stickerData)
      
      // Notify UI
      if (onStickerCreated) {
        onStickerCreated(stickerData)
      }
      
      console.log('Decal created:', imageName)
    },
    undefined,
    (error) => {
      console.error('Error loading texture:', error)
    }
  )
}

// Function to place sticker on mesh surface using raycasting
function placeStickerOnSurface(event, imageUrl, imageName) {
  // Prevent orbit controls from interfering
  event.stopPropagation()
  
  // Calculate mouse position in normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  // Update raycaster
  raycaster.setFromCamera(mouse, camera)
  
  // Check for intersections with backpack meshes
  const intersects = raycaster.intersectObjects(backpackMeshes, false)
  
  if (intersects.length > 0) {
    const intersection = intersects[0]
    const point = intersection.point
    const targetMesh = intersection.object
    
    // Get the normal in world space
    const normal = new THREE.Vector3()
    if (intersection.face) {
      normal.copy(intersection.face.normal)
      if (targetMesh.matrixWorld) {
        normal.transformDirection(targetMesh.matrixWorld)
      }
      normal.normalize()
    } else if (intersection.normal) {
      normal.copy(intersection.normal)
    } else {
      // Fallback
      normal.set(0, 1, 0)
    }
    
    // Create decal at intersection point on the target mesh
    createSticker(imageUrl, imageName, point, normal, targetMesh)
    isPlacingSticker = false
    pendingStickerData = null
  }
}

// Function to update decal when transformed
function updateDecal(stickerData) {
  if (!stickerData || !stickerData.targetMesh) return
  
  // Get position and normal from sticker data
  const position = stickerData.position.clone()
  const normal = stickerData.normal.clone()
  
  // Calculate decal size
  const decalSize = new THREE.Vector3(stickerData.size, stickerData.size, stickerData.size)
  
  // Create orientation quaternion from normal
  const up = new THREE.Vector3(0, 1, 0)
  const quaternion = new THREE.Quaternion()
  quaternion.setFromUnitVectors(up, normal)
  
  // Apply rotation if specified (in degrees)
  if (stickerData.rotation !== undefined && stickerData.rotation !== 0) {
    const rotationQuat = new THREE.Quaternion()
    rotationQuat.setFromAxisAngle(normal, (stickerData.rotation * Math.PI) / 180)
    quaternion.multiply(rotationQuat)
  }
  
  // Remove old decal mesh from scene
  if (stickerData.mesh && stickerData.mesh.parent) {
    scene.remove(stickerData.mesh)
  }
  
  // Dispose old geometry
  if (stickerData.geometry) {
    stickerData.geometry.dispose()
  }
  
  // Create new decal geometry with updated parameters
  try {
    const decalGeometry = new DecalGeometry(
      stickerData.targetMesh,
      position,
      normal,
      decalSize,
      quaternion
    )
    
    // Update the mesh geometry
    stickerData.geometry = decalGeometry
    stickerData.mesh.geometry = decalGeometry
    
    // Re-add to scene
    scene.add(stickerData.mesh)
  } catch (error) {
    console.error('Error updating decal:', error)
    // If decal creation fails, try to restore the old one
    if (stickerData.geometry) {
      stickerData.mesh.geometry = stickerData.geometry
      scene.add(stickerData.mesh)
    }
  }
  
  // Update outline if it exists and sticker is selected
  if (stickerData.outline && selectedSticker === stickerData) {
    updateOutline(stickerData)
  }
}

// Function to create/update outline for selected sticker
function updateOutline(stickerData) {
  // Remove old outline
  if (stickerData.outline) {
    scene.remove(stickerData.outline)
    stickerData.outline.geometry.dispose()
    stickerData.outline.material.dispose()
  }
  
  // Create edges geometry from decal geometry
  const edgesGeometry = new THREE.EdgesGeometry(stickerData.mesh.geometry)
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: 0x646cff,
    linewidth: 2
  })
  
  stickerData.outline = new THREE.LineSegments(edgesGeometry, outlineMaterial)
  // Outline should match the decal mesh exactly
  stickerData.outline.position.copy(stickerData.mesh.position)
  stickerData.outline.quaternion.copy(stickerData.mesh.quaternion)
  stickerData.outline.scale.copy(stickerData.mesh.scale)
  
  scene.add(stickerData.outline)
}

// Function to remove outline
function removeOutline(stickerData) {
  if (stickerData.outline) {
    scene.remove(stickerData.outline)
    stickerData.outline.geometry.dispose()
    stickerData.outline.material.dispose()
    stickerData.outline = null
  }
}

// Transform controls change handler
let transformChangeHandler = null

// Function to select a sticker
function selectSticker(stickerData) {
  // Deselect previous sticker
  if (selectedSticker) {
    transformControls.detach()
    if (transformChangeHandler) {
      transformControls.removeEventListener('change', transformChangeHandler)
    }
    removeOutline(selectedSticker)
  }
  
  selectedSticker = stickerData
  
  // Create or update helper object for transform controls (since decals can't be directly transformed)
  if (!stickerData.helper) {
    const helperGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)
    const helperMaterial = new THREE.MeshBasicMaterial({ visible: false })
    stickerData.helper = new THREE.Mesh(helperGeometry, helperMaterial)
    scene.add(stickerData.helper)
  }
  
  // Always sync helper with current sticker data
  stickerData.helper.position.copy(stickerData.position)
  const up = new THREE.Vector3(0, 1, 0)
  const quaternion = new THREE.Quaternion()
  quaternion.setFromUnitVectors(up, stickerData.normal)
  
  // Apply rotation if it exists
  if (stickerData.rotation !== undefined && stickerData.rotation !== 0) {
    const rotationQuat = new THREE.Quaternion()
    rotationQuat.setFromAxisAngle(stickerData.normal, (stickerData.rotation * Math.PI) / 180)
    quaternion.multiply(rotationQuat)
  }
  stickerData.helper.quaternion.copy(quaternion)
  
  // Sync scale
  const scale = (stickerData.size || 0.3) / 0.3
  stickerData.helper.scale.set(scale, scale, scale)
  
  transformControls.attach(stickerData.helper)
  transformControls.setMode('translate')
  
  // Remove old handler if it exists
  if (transformChangeHandler) {
    transformControls.removeEventListener('change', transformChangeHandler)
  }
  
  // Create change handler for this sticker
  transformChangeHandler = () => {
    if (selectedSticker === stickerData && stickerData.helper) {
      // Update decal position from helper
      const newPosition = stickerData.helper.position.clone()
      stickerData.position.copy(newPosition)
      
      // Recreate decal with new parameters
      updateDecal(stickerData)
    }
  }
  
  transformControls.addEventListener('change', transformChangeHandler)
  
  // Add outline to selected sticker
  updateOutline(stickerData)
  
  // Notify UI
  if (onStickerSelected) {
    onStickerSelected(stickerData)
  }
}

// Function to update sticker rotation
function updateStickerRotation(stickerData, rotationDegrees) {
  if (!stickerData) {
    console.warn('updateStickerRotation: No sticker data provided')
    return
  }
  
  const rotation = parseFloat(rotationDegrees) || 0
  stickerData.rotation = rotation
  console.log('Updating sticker rotation to:', rotation)
  
  updateDecal(stickerData)
  
  // Update helper rotation if it exists
  if (stickerData.helper) {
    const up = new THREE.Vector3(0, 1, 0)
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(up, stickerData.normal)
    
    if (rotation !== 0) {
      const rotationQuat = new THREE.Quaternion()
      rotationQuat.setFromAxisAngle(stickerData.normal, (rotation * Math.PI) / 180)
      quaternion.multiply(rotationQuat)
    }
    stickerData.helper.quaternion.copy(quaternion)
  }
}

// Function to update sticker scale
function updateStickerScale(stickerData, scale) {
  if (!stickerData) return
  stickerData.size = 0.3 * (scale || 1)
  updateDecal(stickerData)
  
  // Update helper scale if it exists
  if (stickerData.helper) {
    stickerData.helper.scale.set(scale || 1, scale || 1, scale || 1)
  }
}

// Function to set transform mode (translate, rotate, scale)
function setTransformMode(mode) {
  if (transformControls && selectedSticker) {
    transformControls.setMode(mode)
  }
}

// Function to remove a sticker
function removeSticker(stickerData) {
  const index = stickers.indexOf(stickerData)
  if (index > -1) {
    // Remove outline
    removeOutline(stickerData)
    
    // Remove from scene
    scene.remove(stickerData.mesh)
    if (stickerData.helper) {
      scene.remove(stickerData.helper)
      stickerData.helper.geometry.dispose()
      stickerData.helper.material.dispose()
    }
    
    // Dispose of geometry, material, and texture
    stickerData.geometry.dispose()
    stickerData.material.dispose()
    stickerData.texture.dispose()
    
    // Remove from array
    stickers.splice(index, 1)
    
    // Deselect if it was selected
    if (selectedSticker === stickerData) {
      selectedSticker = null
      transformControls.detach()
    }
  }
}

// Function to handle image upload - prepare for placement
function handleImageUpload(imageUrl, imageName) {
  isPlacingSticker = true
  pendingStickerData = { url: imageUrl, name: imageName }
  
  // Temporarily disable orbit controls
  controls.enabled = false
  
  // Change cursor to indicate placement mode
  renderer.domElement.style.cursor = 'crosshair'
  
  // Add click listener for placement
  const placeSticker = (event) => {
    if (isPlacingSticker && pendingStickerData) {
      placeStickerOnSurface(event, pendingStickerData.url, pendingStickerData.name)
      renderer.domElement.removeEventListener('click', placeSticker)
      renderer.domElement.style.cursor = 'default'
      controls.enabled = true
    }
  }
  
  renderer.domElement.addEventListener('click', placeSticker, { once: true })
}

// Load the backpack model
const loader = new OBJLoader()
loader.load(
  '/model/backpack.obj',
  (object) => {
    backpackObject = object
    
    // Calculate initial bounding box to get center and size
    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    
    // Center the geometry by translating vertices
    object.traverse((child) => {
      if (child.isMesh && child.geometry) {
        child.geometry.translate(-center.x, -center.y, -center.z)
      }
    })
    
    // Reset object position to origin
    object.position.set(0, 0, 0)
    
    // Scale the model to fit nicely in the scene
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 2 / maxDim
    object.scale.set(scale, scale, scale)
    object.rotation.set(-90, 0, 0)
    
    // Add a default material if the model doesn't have one
    object.traverse((child) => {
      if (child.isMesh) {
        // Store reference to mesh for color updates
        backpackMeshes.push(child)
        
        if (!child.material || child.material.length === 0) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.7,
            metalness: 0.3
          })
        }
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    
    scene.add(object)
    
    // Update camera to look at the center
    camera.lookAt(0, 0, 0)
    controls.target.set(0, 0, 0)
    controls.update()
    
    // Verify centering
    // const finalBox = new THREE.Box3().setFromObject(object)
    // const finalCenter = finalBox.getCenter(new THREE.Vector3())
    // console.log('Backpack model loaded successfully')
    // console.log('Model center:', finalCenter)
    // console.log('Model size:', finalBox.getSize(new THREE.Vector3()))
  },
  (progress) => {
    // console.log('Loading progress:', (progress.loaded / progress.total) * 100 + '%')
  },
  (error) => {
    // console.error('Error loading model:', error)
  }
)

// // Add a grid helper
// const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
// scene.add(gridHelper)

// // Add axes helper
// const axesHelper = new THREE.AxesHelper(2)
// scene.add(axesHelper)

// Animation loop
function animate() {
  requestAnimationFrame(animate)
  controls.update()
  
  // Update transform controls if they exist
  // TransformControls needs to be updated in the animation loop
  if (transformControls) {
    // Check if it's in the scene, if not, we need to update it manually
    if (transformControls.parent === scene || transformControls.parent !== null) {
      // It's in the scene, normal update
    } else {
      // Not in scene, but we can still use it
      transformControls.updateMatrixWorld()
    }
  }
  
  renderer.render(scene, camera)
}

animate()

// Initialize color picker with callbacks
const colorPicker = createColorPicker(
  updateBackpackColor,
  (imageUrl, imageName) => {
    handleImageUpload(imageUrl, imageName)
  },
  setTransformMode,
  (stickerData, rotation) => {
    updateStickerRotation(stickerData, rotation)
  },
  (stickerData, scale) => {
    updateStickerScale(stickerData, scale)
  }
)

// Set callbacks
onStickerCreated = (stickerData) => {
  colorPicker.addStickerToList(stickerData, () => {
    removeSticker(stickerData)
  })
}

onStickerSelected = (stickerData) => {
  colorPicker.selectSticker(stickerData)
}

// Keyboard shortcuts for transform modes
window.addEventListener('keydown', (event) => {
  if (!selectedSticker) return
  
  switch (event.key.toLowerCase()) {
    case 'g': // Grab/Translate
      setTransformMode('translate')
      break
    case 'r': // Rotate
      setTransformMode('rotate')
      break
    case 's': // Scale
      setTransformMode('scale')
      break
  }
})

// Handle window resize
// Handle window resize
window.addEventListener('resize', () => {
  const container = document.querySelector('#app')
  camera.aspect = container.clientWidth / container.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.clientWidth, container.clientHeight)
})
