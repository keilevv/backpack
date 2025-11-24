import './style.css'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createColorPicker } from './colorPicker.js'

// Set up the scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a1a)

// Set up the camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0, 0, 5)

// Set up the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.querySelector('#app').appendChild(renderer.domElement)

// Add orbit controls for interaction
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05

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

// Function to update backpack color
function updateBackpackColor(color) {
  const threeColor = new THREE.Color(color)
  backpackMeshes.forEach((mesh) => {
    if (mesh.material) {
      // Handle both single material and material arrays
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => {
          if (mat) mat.color.copy(threeColor)
        })
      } else {
        mesh.material.color.copy(threeColor)
      }
    }
  })
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
      console.log(child)
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
  renderer.render(scene, camera)
}

animate()

// Initialize color picker
createColorPicker(updateBackpackColor)

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
