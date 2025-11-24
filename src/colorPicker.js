export function createColorPicker(onColorChange, onImageUpload, setTransformMode, onRotationChange, onScaleChange) {
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
  colorInput.value = '#888888'
  
  colorInput.addEventListener('input', (e) => {
    const color = e.target.value
    if (onColorChange) {
      onColorChange(color)
    }
  })
  
  // Create image upload section
  const imageSection = document.createElement('div')
  imageSection.className = 'color-section'
  
  const imageLabel = document.createElement('label')
  imageLabel.textContent = 'Add Sticker/Image'
  imageLabel.className = 'color-label'
  imageLabel.setAttribute('for', 'backpack-image')
  
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.id = 'backpack-image'
  fileInput.className = 'file-input'
  fileInput.accept = 'image/*'
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file && onImageUpload) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target.result
        onImageUpload(imageUrl, file.name)
      }
      reader.readAsDataURL(file)
    }
    fileInput.value = ''
  })
  
  const fileInputLabel = document.createElement('label')
  fileInputLabel.className = 'file-input-label'
  fileInputLabel.setAttribute('for', 'backpack-image')
  fileInputLabel.textContent = 'Choose Image...'
  
  // Create stickers list
  const stickersList = document.createElement('div')
  stickersList.className = 'images-list'
  stickersList.id = 'stickers-list'
  
  // Create transform controls section
  const transformSection = document.createElement('div')
  transformSection.className = 'color-section'
  transformSection.id = 'transform-controls'
  transformSection.style.display = 'none'
  
  const transformLabel = document.createElement('label')
  transformLabel.textContent = 'Transform Controls'
  transformLabel.className = 'color-label'
  
  // Move button
  const translateBtn = document.createElement('button')
  translateBtn.className = 'transform-btn active'
  translateBtn.textContent = 'Move (G)'
  translateBtn.addEventListener('click', () => {
    if (setTransformMode) setTransformMode('translate')
    updateTransformButton(translateBtn)
  })
  
  // Rotation input
  const rotationSection = document.createElement('div')
  rotationSection.className = 'input-control-section'
  
  const rotationLabel = document.createElement('label')
  rotationLabel.textContent = 'Rotation (degrees)'
  rotationLabel.className = 'input-label'
  rotationLabel.setAttribute('for', 'rotation-input')
  
  const rotationInput = document.createElement('input')
  rotationInput.type = 'number'
  rotationInput.id = 'rotation-input'
  rotationInput.className = 'transform-input'
  rotationInput.value = '0'
  rotationInput.min = '-360'
  rotationInput.max = '360'
  rotationInput.step = '1'
  
  rotationInput.addEventListener('input', (e) => {
    const rotation = parseFloat(e.target.value) || 0
    if (onRotationChange && currentSelectedSticker) {
      onRotationChange(currentSelectedSticker, rotation)
    }
  })
  
  rotationSection.appendChild(rotationLabel)
  rotationSection.appendChild(rotationInput)
  
  // Scale input
  const scaleSection = document.createElement('div')
  scaleSection.className = 'input-control-section'
  
  const scaleLabel = document.createElement('label')
  scaleLabel.textContent = 'Scale'
  scaleLabel.className = 'input-label'
  scaleLabel.setAttribute('for', 'scale-input')
  
  const scaleInput = document.createElement('input')
  scaleInput.type = 'number'
  scaleInput.id = 'scale-input'
  scaleInput.className = 'transform-input'
  scaleInput.value = '1'
  scaleInput.min = '0.1'
  scaleInput.max = '5'
  scaleInput.step = '0.1'
  
  scaleInput.addEventListener('input', (e) => {
    const scale = parseFloat(e.target.value) || 1
    if (onScaleChange && currentSelectedSticker) {
      onScaleChange(currentSelectedSticker, scale)
    }
  })
  
  scaleSection.appendChild(scaleLabel)
  scaleSection.appendChild(scaleInput)
  
  function updateTransformButton(activeBtn) {
    translateBtn.classList.remove('active')
    activeBtn.classList.add('active')
  }
  
  let currentSelectedSticker = null
  
  transformSection.appendChild(transformLabel)
  transformSection.appendChild(translateBtn)
  transformSection.appendChild(rotationSection)
  transformSection.appendChild(scaleSection)
  
  // Assemble the sidebar
  colorSection.appendChild(colorLabel)
  colorSection.appendChild(colorInput)
  
  imageSection.appendChild(imageLabel)
  imageSection.appendChild(fileInputLabel)
  imageSection.appendChild(fileInput)
  imageSection.appendChild(stickersList)
  
  sidebarContent.appendChild(title)
  sidebarContent.appendChild(colorSection)
  sidebarContent.appendChild(imageSection)
  sidebarContent.appendChild(transformSection)
  sidebar.appendChild(sidebarContent)
  
  document.body.appendChild(sidebar)
  
  // Function to add sticker to the list
  const addStickerToList = (stickerData, onRemove) => {
    const stickerItem = document.createElement('div')
    stickerItem.className = 'image-item sticker-item'
    
    const imagePreview = document.createElement('img')
    imagePreview.src = stickerData.url
    imagePreview.className = 'image-preview'
    imagePreview.alt = stickerData.name
    
    const stickerNameSpan = document.createElement('span')
    stickerNameSpan.className = 'image-name'
    stickerNameSpan.textContent = stickerData.name
    
    const removeButton = document.createElement('button')
    removeButton.className = 'remove-image-btn'
    removeButton.textContent = '×'
    removeButton.addEventListener('click', (e) => {
      e.stopPropagation()
      if (onRemove) {
        onRemove()
      }
      stickerItem.remove()
    })
    
    stickerItem.appendChild(imagePreview)
    stickerItem.appendChild(stickerNameSpan)
    stickerItem.appendChild(removeButton)
    
    stickerItem.addEventListener('click', () => {
      stickersList.querySelectorAll('.sticker-item').forEach(item => {
        item.classList.remove('active')
      })
      stickerItem.classList.add('active')
    })
    
    stickersList.appendChild(stickerItem)
  }
  
  // Function to select a sticker in the UI
  const selectSticker = (stickerData) => {
    currentSelectedSticker = stickerData
    transformSection.style.display = 'block'
    
    // Update input values
    rotationInput.value = (stickerData.rotation || 0).toString()
    scaleInput.value = ((stickerData.size || 0.3) / 0.3).toFixed(1)
  }
  
  return {
    sidebar,
    colorInput,
    fileInput,
    stickersList,
    addStickerToList,
    selectSticker,
    setColor: (color) => {
      colorInput.value = color
    },
    getColor: () => {
      return colorInput.value
    }
  }
}

