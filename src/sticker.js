import * as THREE from 'three'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

// Sticker system state
const stickers = [] // Array to store all sticker objects
let selectedSticker = null
let raycaster = new THREE.Raycaster()
let mouse = new THREE.Vector2()
let isPlacingSticker = false
let pendingStickerData = null
let transformControls = null
let textureLoader = new THREE.TextureLoader()

// Mouse state for click detection
let mouseDownTime = 0
let mouseDownPos = new THREE.Vector2()

// References needed from main
let sceneRef = null
let cameraRef = null
let rendererRef = null
let backpackMeshesRef = null
let controlsRef = null // OrbitControls
let onStickerCreated = null
let onStickerSelected = null

export function initStickerSystem(scene, camera, renderer, backpackMeshes, controls, onCreated, onSelected) {
  sceneRef = scene
  cameraRef = camera
  rendererRef = renderer
  backpackMeshesRef = backpackMeshes
  controlsRef = controls
  onStickerCreated = onCreated
  onStickerSelected = onSelected

  initTransformControls()
  
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
      case 'delete':
      case 'backspace':
        removeSticker(selectedSticker)
        break
    }
  })

  // Mouse event listeners for selection
  renderer.domElement.addEventListener('mousedown', onMouseDown)
  renderer.domElement.addEventListener('mouseup', onMouseUp)
}

function onMouseDown(event) {
  mouseDownTime = Date.now()
  mouseDownPos.set(event.clientX, event.clientY)
}

function onMouseUp(event) {
  // Only trigger if it's a click (short duration and small movement)
  const timeDiff = Date.now() - mouseDownTime
  const dist = mouseDownPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY))
  
  if (timeDiff < 300 && dist < 5) {
    onMouseClick(event)
  }
}

function onMouseClick(event) {
  if (isPlacingSticker) return // Don't interfere with placement

  // Calculate mouse position
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, cameraRef)

  // Check for intersection with stickers first
  const stickerMeshes = stickers.map(s => s.mesh)
  const stickerIntersects = raycaster.intersectObjects(stickerMeshes, false)

  if (stickerIntersects.length > 0) {
    // Clicked on a sticker
    const clickedMesh = stickerIntersects[0].object
    const clickedSticker = stickers.find(s => s.mesh === clickedMesh)
    if (clickedSticker) {
      selectSticker(clickedSticker)
      return
    }
  }

  // If we didn't click a sticker, check if we clicked the background (or backpack)
  // If we clicked outside any sticker, deselect
  deselectSticker()
}

// Initialize transform controls
function initTransformControls() {
  try {
    transformControls = new TransformControls(cameraRef, rendererRef.domElement)
    console.log("transformControls", transformControls)
    transformControls.addEventListener('dragging-changed', (event) => {
      controlsRef.enabled = !event.value
    })
    
    sceneRef.add(transformControls) // Add to scene to ensure it works correctly
    console.log('TransformControls initialized and added to scene')
  } catch (error) {
    console.error('Failed to initialize TransformControls:', error)
  }
}

// Update transform controls in animation loop
export function updateStickerSystem() {
  // No manual update needed if added to scene, but we keep the function for consistency
}

// Function to create a decal on the mesh surface
function createSticker(imageUrl, imageName, position, normal, targetMesh) {
  textureLoader.load(
    imageUrl,
    (texture) => {
      // Configure texture - flip Y to fix orientation
      texture.flipY = true
      texture.colorSpace = THREE.SRGBColorSpace
      
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
        wireframe: false,
        shininess: 30,
        specular: 0x111111
      })
      
      // Create the decal mesh
      const decal = new THREE.Mesh(decalGeometry, material)
      decal.renderOrder = 1 // Ensure it renders on top of backpack
      
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
      sceneRef.add(decal)
      
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
  raycaster.setFromCamera(mouse, cameraRef)
  
  // Check for intersections with backpack meshes
  const intersects = raycaster.intersectObjects(backpackMeshesRef, false)
  
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
  
  // Validate position to prevent NaN errors
  if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
    console.warn('Invalid position for decal update:', position)
    return
  }

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
    sceneRef.remove(stickerData.mesh)
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
    sceneRef.add(stickerData.mesh)
  } catch (error) {
    console.error('Error updating decal:', error)
    // If decal creation fails, try to restore the old one
    if (stickerData.geometry) {
      stickerData.mesh.geometry = stickerData.geometry
      sceneRef.add(stickerData.mesh)
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
    sceneRef.remove(stickerData.outline)
    stickerData.outline.geometry.dispose()
    stickerData.outline.material.dispose()
  }
  
  // Create edges geometry from decal geometry
  const edgesGeometry = new THREE.EdgesGeometry(stickerData.mesh.geometry)
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: 0x00ff00, // Bright green for better visibility
    linewidth: 2,
    depthTest: false, // Always visible on top
    depthWrite: false
  })
  
  stickerData.outline = new THREE.LineSegments(edgesGeometry, outlineMaterial)
  stickerData.outline.renderOrder = 2 // Render on top of decal
  
  // Outline should match the decal mesh exactly
  stickerData.outline.position.copy(stickerData.mesh.position)
  stickerData.outline.quaternion.copy(stickerData.mesh.quaternion)
  stickerData.outline.scale.copy(stickerData.mesh.scale)
  
  sceneRef.add(stickerData.outline)
}

// Function to remove outline
function removeOutline(stickerData) {
  if (stickerData && stickerData.outline) {
    sceneRef.remove(stickerData.outline)
    stickerData.outline.geometry.dispose()
    stickerData.outline.material.dispose()
    stickerData.outline = null
  }
}

// Transform controls change handler
let transformChangeHandler = null

// Function to deselect current sticker
export function deselectSticker() {
  if (selectedSticker) {
    transformControls.detach()
    if (transformChangeHandler) {
      transformControls.removeEventListener('change', transformChangeHandler)
    }
    removeOutline(selectedSticker)
    selectedSticker = null
    
    // Notify UI
    if (onStickerSelected) {
      onStickerSelected(null)
    }
  }
}

// Function to select a sticker
export function selectSticker(stickerData) {
  // Deselect previous sticker
  if (selectedSticker && selectedSticker !== stickerData) {
    deselectSticker()
  }
  
  selectedSticker = stickerData
  
  // Create or update helper object for transform controls (since decals can't be directly transformed)
  if (!stickerData.helper) {
    const helperGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)
    const helperMaterial = new THREE.MeshBasicMaterial({ visible: false })
    stickerData.helper = new THREE.Mesh(helperGeometry, helperMaterial)
    sceneRef.add(stickerData.helper)
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
      
      // Check for NaN values
      if (isNaN(newPosition.x) || isNaN(newPosition.y) || isNaN(newPosition.z)) {
        return
      }

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
export function updateStickerRotation(stickerData, rotationDegrees) {
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
export function updateStickerScale(stickerData, scale) {
  if (!stickerData) return
  stickerData.size = 0.3 * (scale || 1)
  updateDecal(stickerData)
  
  // Update helper scale if it exists
  if (stickerData.helper) {
    stickerData.helper.scale.set(scale || 1, scale || 1, scale || 1)
  }
}

// Function to set transform mode (translate, rotate, scale)
export function setTransformMode(mode) {
  if (transformControls && selectedSticker) {
    transformControls.setMode(mode)
  }
}

// Function to remove a sticker
export function removeSticker(stickerData) {
  const index = stickers.indexOf(stickerData)
  if (index > -1) {
    // Remove outline
    removeOutline(stickerData)
    
    // Remove from scene
    sceneRef.remove(stickerData.mesh)
    if (stickerData.helper) {
      sceneRef.remove(stickerData.helper)
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
      if (onStickerSelected) {
        onStickerSelected(null)
      }
    }
  }
}

// Function to handle image upload - prepare for placement
export function handleImageUpload(imageUrl, imageName) {
  isPlacingSticker = true
  pendingStickerData = { url: imageUrl, name: imageName }
  
  // Temporarily disable orbit controls
  controlsRef.enabled = false
  
  // Change cursor to indicate placement mode
  rendererRef.domElement.style.cursor = 'crosshair'
  
  // Add click listener for placement
  const placeSticker = (event) => {
    if (isPlacingSticker && pendingStickerData) {
      placeStickerOnSurface(event, pendingStickerData.url, pendingStickerData.name)
      rendererRef.domElement.removeEventListener('click', placeSticker)
      rendererRef.domElement.style.cursor = 'default'
      controlsRef.enabled = true
    }
  }
  
  rendererRef.domElement.addEventListener('click', placeSticker, { once: true })
}
