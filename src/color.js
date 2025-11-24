import * as THREE from 'three'

// Function to update backpack color
export function updateBackpackColor(color, backpackMeshes) {
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
