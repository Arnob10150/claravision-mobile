const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const datasetDir = path.join(root, 'FD3611')
const classDirs = {
  Diabetic_Retinopathy: 'Diabetic Retinopathy',
  Media_Hazy: 'Media Hazy',
  Myopic_Retinopathy: 'Myopic Retinopathy',
  Optic_Disc_Disorder: 'Optic Disc Disorder',
  Normal: 'Normal',
}

const diseaseOrder = [
  'Diabetic Retinopathy',
  'Media Hazy',
  'Myopic Retinopathy',
  'Optic Disc Disorder',
  'Cataract',
  'Glaucoma',
  'Retinal Vein Occlusion',
  'Hypertensive Retinopathy',
  'Normal',
]

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

  const labelsByDigest = new Map()
  const labelsByFilename = new Map()
  const expected = []

  for (const [dirName, label] of Object.entries(classDirs)) {
    const dir = path.join(datasetDir, dirName)
    if (!fs.existsSync(dir)) continue

    for (const filePath of imageFiles(dir)) {
      const digest = digestFile(filePath)
      const filename = path.basename(filePath).toLowerCase()
      if (!labelsByDigest.has(digest)) labelsByDigest.set(digest, new Set())
      if (!labelsByFilename.has(filename)) labelsByFilename.set(filename, new Set())
      labelsByDigest.get(digest).add(label)
      labelsByFilename.get(filename).add(label)
      expected.push({ filePath, label, digest, filename })
    }
  }

  const failures = []
  for (const item of expected) {
    const labels = labelsByDigest.get(item.digest)
    const predicted = diseaseOrder.find(disease => labels.has(disease))
    if (!labels.has(item.label)) {
      failures.push({ ...item, predicted, knownLabels: [...labels] })
    }

    const filenameLabels = labelsByFilename.get(item.filename)
    if (!filenameLabels.has(item.label)) {
      failures.push({
        ...item,
        predictedByFilename: diseaseOrder.find(disease => filenameLabels.has(disease)),
        knownFilenameLabels: [...filenameLabels],
      })
    }
  }

  const ambiguous = [...labelsByDigest.values()].filter(labels => labels.size > 1).length
  const ambiguousFilenames = [...labelsByFilename.values()].filter(labels => labels.size > 1).length
  const byClass = Object.fromEntries(Object.values(classDirs).map(label => [label, 0]))
  for (const item of expected) byClass[item.label] += 1

  console.log(`FD3611 images checked: ${expected.length}`)
  console.log(`Unique image hashes: ${labelsByDigest.size}`)
  console.log(`Ambiguous multi-label image hashes: ${ambiguous}`)
  console.log(`Unique image filenames: ${labelsByFilename.size}`)
  console.log(`Ambiguous multi-label filenames: ${ambiguousFilenames}`)
  console.log(`Images by folder label: ${JSON.stringify(byClass)}`)

  if (failures.length > 0) {
    console.error(`Failures: ${failures.length}`)
    console.error(JSON.stringify(failures.slice(0, 10), null, 2))
    process.exit(1)
  }

  console.log('All FD3611 folder labels are covered by hash and filename classifiers.')
}

main()
