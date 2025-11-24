export function createColorPicker(onColorChange) {
  // Create sidebar container
  const sidebar = document.createElement('div')
  sidebar.id = 'color-picker-sidebar'
  sidebar.className = 'sidebar'
  
  // Create sidebar content
  const sidebarContent = document.createElement('div')
  sidebarContent.className = 'sidebar-content'
  
  // Create title
  const title = document.createElement('h2')
  title.textContent = 'Backpack Customizer'
  title.className = 'sidebar-title'
  
  // Create color picker section
  const colorSection = document.createElement('div')
  colorSection.className = 'color-section'
  
  const colorLabel = document.createElement('label')
  colorLabel.textContent = 'Backpack Color'
  colorLabel.className = 'color-label'
  colorLabel.setAttribute('for', 'backpack-color')
  
  const colorInput = document.createElement('input')
  colorInput.type = 'color'
  colorInput.id = 'backpack-color'
  colorInput.className = 'color-input'
  colorInput.value = '#888888' // Default color matching the initial material
  
  // Handle color change
  colorInput.addEventListener('input', (e) => {
    const color = e.target.value
    if (onColorChange) {
      onColorChange(color)
    }
  })
  
  // Assemble the sidebar
  colorSection.appendChild(colorLabel)
  colorSection.appendChild(colorInput)
  sidebarContent.appendChild(title)
  sidebarContent.appendChild(colorSection)
  sidebar.appendChild(sidebarContent)
  
  // Append to body
  document.body.appendChild(sidebar)
  
  // Return the color input for external access if needed
  return {
    sidebar,
    colorInput,
    setColor: (color) => {
      colorInput.value = color
    },
    getColor: () => {
      return colorInput.value
    }
  }
}

