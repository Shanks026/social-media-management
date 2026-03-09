// src/lib/cropImage.js

/**
 * Draws the cropped region of an image onto an off-screen canvas
 * and returns the result as a Blob.
 *
 * @param {string} imageSrc  - objectURL or remote URL of the source image
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @returns {Promise<Blob>}
 */
export function getCroppedImg(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      )

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'))
        resolve(blob)
      }, 'image/png')
    })
    image.addEventListener('error', reject)
    image.src = imageSrc
  })
}
