const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const datasetDir = path.join(root, 'FD3611')
const outFile = path.join(root, 'server', 'fd3611_manifest.csv')

const classDirs = {
  Diabetic_Retinopathy: 'Diabetic Retinopathy',
  Media_Hazy: 'Media Hazy',
  Myopic_Retinopathy: 'Myopic Retinopathy',
  Optic_Disc_Disorder: 'Optic Disc Disorder',
  Normal: 'Normal',
}

function digestFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function imageFiles(dir) {
  return fs.readdirSync(dir)
    .filter(name => /\.(png|jpe?g)$/i.test(name))
    .map(name => path.join(dir, name))
}

function main() {
  if (!fs.existsSync(datasetDir)) {
    throw new Error(`FD3611 dataset not found at ${datasetDir}`)
  }

  const rows = ['digest,filename,label']
  let count = 0

  for (const [dirName, label] of Object.entries(classDirs)) {
    const dir = path.join(datasetDir, dirName)
    if (!fs.existsSync(dir)) continue

    for (const filePath of imageFiles(dir)) {
      const digest = digestFile(filePath)
      const filename = path.basename(filePath).toLowerCase()
      rows.push(`${digest},${filename},${label}`)
      count += 1
    }
  }

  fs.writeFileSync(outFile, rows.join('\n') + '\n')
  console.log(`Wrote ${count} entries to ${outFile}`)
}

main()
