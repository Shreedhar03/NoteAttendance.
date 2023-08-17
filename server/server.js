// import dotenv from 'dotenv'
const dotenv = require('dotenv')
dotenv.config()
const { GoogleSpreadsheet } = require('google-spreadsheet')
const { JWT } = require('google-auth-library')
const { DateTime, Settings } = require("luxon");
const cors = require('cors')

const { config } = require('./config')

const express = require('express')

const app = express()
app.use(cors())

const serviceAccountAuth = new JWT({
  email: process.env.client_email,
  key: process.env.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

app.listen(8080, () => console.log('Server running on 8080'))

app.use(express.json())

// Setting default timezone for luxon
Settings.defaultZone = "Asia/Kolkata"

// Preparing structure from config

const structure = {}
for (let key in config) {
  let ref = JSON.parse(JSON.stringify(config[key]['A']))
  let year = { theory: ref.theory, labs: ref.labs }
  if (ref.hasElectives) {
    ref.electives.forEach(elective => {
      year.theory.push(`${ref.electiveSheetName}: ${elective.name}`)
    })
  }
  year.batches = Object.keys(ref.batches)
  structure[key] = year
}
// console.log(structure)

app.get('/api/get_structure', (req, res) => {
  res.json(structure)
})

app.get('/api/get_students', async (req, res) => {

  try {

    const { year, div, subject, batch } = req.query
    // const { year, div, subject, batch } = req.body // For debugging
    const currentClass = config[year][div]

    // Connecting to GDoc api
    const doc = new GoogleSpreadsheet(
      currentClass.sheetId,
      serviceAccountAuth
    )

    // Loading document info
    await doc.loadInfo()
    console.log('TITLE: ', doc.title)

    const sheet = doc.sheetsByTitle[subject]

    const date = DateTime.now().toFormat("dd'/'MM")
    // const date = "14/08" // For debugging
    await sheet.loadHeaderRow() // Load header row to get column names
    const columnIndex = sheet.headerValues.indexOf(date)

    // Getting all cells
    await sheet.loadCells()

    let students = []
    let entryExists = false

    // Setting value of entryExists based on student count of that day
    // console.log(columnIndex)
    if (sheet.getCell(currentClass.lastRoll + 1, columnIndex).value !== 0) {
      entryExists = true
    }

    if (currentClass.theory.includes(subject)) {
      // Subject is theory
      for (let i = 1; i <= currentClass.lastRoll; i++) {
        let student = {}
        // students.push({ roll: sheet.getCell(i, 0).value, name: sheet.getCell(i, 1).value })
        student.roll = sheet.getCell(i, 0).value
        student.name = sheet.getCell(i, 1).value
        student.status = sheet.getCell(i, columnIndex).value > 0 ? true : false
        students.push(student)
      }

    } else if (currentClass.labs.includes(subject)) {
      // Subject is a lab
      if (currentClass.batches.hasOwnProperty(batch)) {
        // Valid batch provided
        for (let i = currentClass.batches[batch].start; i <= currentClass.batches[batch].end; i++) {
          students.push({ roll: sheet.getCell(i, 0).value, name: sheet.getCell(i, 1).value })
        }

      } else {
        // Invalid batch
        return res.status(400).send("Invalid request")
      }
    } else {
      // Invalid subject
      return res.status(400).send("Invalid request")
    }

    res.json({ entryExists, students })
  } catch (err) {
    console.log(err.message)
    return res.status(400).send("Invalid request")
  }
})

app.post("/api/mark_attendance", async (req, res) => {
  console.log("MARKING ATTENDANCE")
  try {
    // Getting data from request
    const { year, div, subject, batch, presentStudents, reqDate, overwrite = false } = req.body

    // Preliminary checks
    // Uses structure declared above to compare requested 'subject' string
    if (!config.hasOwnProperty(year)) {
      console.log("Invalid year provided", year)
      return res.status(400).send("Invalid request")
    }
    if (!config[year].hasOwnProperty(div)) {
      console.log("Invalid division provided: ", div)
      return res.status(400).send("Invalid request")
    }
    if (!structure[year].theory.includes(subject) && !structure[year].labs.includes(subject)) {
      console.log("Invalid subject provided: ", subject)
      return res.status(400).send("Invalid request")
    }
    if (structure[year].labs.includes(subject) && !structure[year].batches.includes(batch)) {
      console.log("Invalid batch provided: ", batch)
      return res.status(400).send("Invalid request")
    }
    const date = DateTime.now().toFormat("dd'/'MM")
    if (reqDate !== date) {
      console.log("Provided date not the current one: ", reqDate, " Expected: ", date)
      return res.status(400).send("Invalid request")
    }

    // Preparation & setting flags
    const currentClass = config[year][div]
    let electiveFlag = false
    let currentElective = ""
    let currentElectiveColor = {}
    if (currentClass.hasElectives && subject.includes(currentClass.electiveSheetName)) {
      electiveFlag = true
    }
    // If elective, getting its color
    if (electiveFlag) {
      currentClass.electives.forEach(el => {
        if (subject.includes(el.name)) {
          currentElective = el.name
          currentElectiveColor = el.color
        }
      })
    }

    console.log(currentElective)

    // Opening spreadsheet
    const doc = new GoogleSpreadsheet(currentClass.sheetId, serviceAccountAuth)
    await doc.loadInfo()
    const sheet = electiveFlag ? doc.sheetsByTitle[currentClass.electiveSheetName] : doc.sheetsByTitle[subject]

    console.log(currentClass.electiveSheetName, subject)

    // Getting date index
    await sheet.loadHeaderRow()
    const columnIndex = sheet.headerValues.indexOf(date)
    if (columnIndex === -1) {
      console.log("Date not found in sheet: ", date, subject)
      res.status(400).send("Invalid request")
    }

    await sheet.loadCells()

    // Setting limits based on batch (only if subject is lab)
    let startLimit = 1
    let endLimit = currentClass.lastRoll
    if (currentClass.labs.includes(subject)) {
      startLimit = currentClass.batches[batch].start
      endLimit = currentClass.batches[batch].end
    }

    let alreadyPresent = false
    let effectiveIndex = 0
    if (sheet.getCell(currentClass.lastRoll + 1, columnIndex).value > 0) {
      // Entries present - check overwrite & create new column
      if (overwrite) {
        // Make changes to same column
        effectiveIndex = columnIndex
      } else {
        // Add new column & make changes to that
        // Get index of current date
        let originalIndex = sheet.headerValues.indexOf(date)
        let currentIndex = originalIndex
        while (sheet.getCell(0, currentIndex).formattedValue.includes('16/08')) {
          currentIndex++
        }
        // Inserting new column
        sheet.insertDimension('COLUMNS', { startIndex: currentIndex, endIndex: currentIndex + 1 }, true)
        // Resetting cache
        sheet.resetLocalCache()
        await doc.loadInfo()
        await sheet.loadCells()
        // Setting header value of new column
        sheet.getCell(0, currentIndex).value = `${sheet.getCell(0, originalIndex).formattedValue}-${currentIndex - originalIndex + 1}`
        const a1 = sheet.getCell(currentClass.lastRoll + 1, currentIndex).a1Column
        // Setting bottom formula
        sheet.getCell(currentClass.lastRoll + 1, currentIndex).formula = `=SUM(${a1}2:${a1}${currentClass.lastRoll})`
        effectiveIndex = currentIndex
      }
    } else {
      // No entries
      effectiveIndex = columnIndex
    }

    // Main loop - for each row in sheet
    for (let i = startLimit; i <= endLimit; i++) {
      let currentRoll = sheet.getCell(i, 0).value
      let currentValue = sheet.getCell(i, effectiveIndex).value
      // Skipping disabled roll nos.
      if (currentClass.disabled.includes(currentRoll)) {
        continue
      }
      // If elective, skip non-relevant students
      if (electiveFlag) {
        if (JSON.stringify(sheet.getCell(i, 1).backgroundColor) !== JSON.stringify(currentElectiveColor)) {
          console.log("PASSED")
          continue
        }
      }

      if (presentStudents.includes(currentRoll)) {
        sheet.getCell(i, effectiveIndex).value = 1
      } else {
        sheet.getCell(i, effectiveIndex).value = 0
      }
    }

    await sheet.saveUpdatedCells()
    res.send("SUCCESS")

  } catch (err) {
    console.log(err.message)
    res.send("ERR")
  }
})


app.get('/api/search_students', async (req, res) => {
  const { year, div } = req.query
  // Preliminary checks
  // Uses structure declared above to compare requested subject string
  if (!config.hasOwnProperty(year)) {
    console.log("Invalid year provided", year)
    return res.status(400).send("Invalid request")
  }
  if (!config[year].hasOwnProperty(div)) {
    console.log("Invalid division provided: ", div)
    return res.status(400).send("Invalid request")
  }

  const currentClass = config[year][div]
  const doc = new GoogleSpreadsheet(currentClass.sheetId, serviceAccountAuth)
  await doc.loadInfo()

  const sheet = doc.sheetsByTitle[currentClass.theory[0]]
  await sheet.loadCells()

  let students = []

  // Add student object to array if name not null
  for (let i = 1; i <= currentClass.lastRoll; i++) {
    if (sheet.getCell(i, 1).value !== null) {
      students.push({ roll: sheet.getCell(i, 0).value, name: sheet.getCell(i, 1).value })
    }
  }

  res.json(students)
})

app.post('/api/get_report', async (req, res) => {
  console.log("REPORT")
  // console.log(JSON.stringify(config))
  try {
    const { year, div, roll } = req.body
    // Preliminary checks
    if (!config.hasOwnProperty(year)) {
      console.log("Invalid year provided", year)
      return res.status(400).send("Invalid request")
    }
    if (!config[year].hasOwnProperty(div)) {
      console.log("Invalid division provided: ", div)
      return res.status(400).send("Invalid request")
    }

    // No. of rows above 1st roll no - 1
    const OFFSET = 1
    const currentRoll = parseInt(roll.slice(4))
    console.log(currentRoll)
    const currentClass = config[year][div]

    if (!(currentRoll >= 0 || currentRoll <= currentClass.lastRoll)) {
      console.log("Invalid roll no. received")
      return res.status(400).send("Invalid request")
    }

    const doc = new GoogleSpreadsheet(currentClass.sheetId, serviceAccountAuth)
    await doc.loadInfo()

    const sheet = doc.sheetsByTitle['REPORT']
    await sheet.loadHeaderRow(2)
    await sheet.loadCells()

    let report = {}

    // Adding overalls
    report.roll = sheet.getCell(currentRoll + OFFSET, 0).value
    report.name = sheet.getCell(currentRoll + OFFSET, 1).value
    report.overall = `${Math.floor(sheet.getCell(currentRoll + OFFSET, sheet.headerValues.indexOf('OVERALL')).value * 100)}%`
    report.theory = `${Math.floor(sheet.getCell(currentRoll + OFFSET, sheet.headerValues.indexOf('THEORY')).value * 100)}%`
    report.labs = `${Math.floor(sheet.getCell(currentRoll + OFFSET, sheet.headerValues.indexOf('LABS')).value * 100)}%`

    // Adding distribution
    let theoryDist = []
    currentClass.theory.forEach(sub => {
      let colIndex = sheet.headerValues.indexOf(sub)
      theoryDist.push(
        {
          title: sub,
          percentage: `${Math.floor(sheet.getCell(currentRoll + OFFSET, colIndex + 1).value*100)}%`,
          attended: sheet.getCell(currentRoll + OFFSET, colIndex).formattedValue,
          outOf: sheet.getCell(currentClass.lastRoll + OFFSET + 1, colIndex).formattedValue
        }
      )
    })
    report.theoryDist = theoryDist

    // Adding elective info if present
    if (currentClass.hasElectives) {
      let colIndex = sheet.headerValues.indexOf(currentClass.electiveSheetName)
      theoryDist.push(
        {
          title: currentClass.electiveSheetName,
          percentage: `${Math.floor(sheet.getCell(currentRoll + OFFSET, colIndex + 1).value*100)}%`
        }
      )
    }

    let labsDist = []
    currentClass.labs.forEach(lab => {
      let colIndex = sheet.headerValues.indexOf(lab)
      labsDist.push(
        {
          title: lab,
          percentage: `${Math.floor(sheet.getCell(currentRoll + OFFSET, colIndex + 1).value*100)}%`
        }
      )
    })
    report.labsDist = labsDist

    console.log("SUCCESS")
    res.json(report)

  } catch (err) {
    console.log(err.message)
    res.status(400).send("Invalid request")
  }
})

app.get('/api/test', async (req, res) => {
  const currentClass = config['TE']['A']
  const doc = new GoogleSpreadsheet(currentClass.sheetId, serviceAccountAuth)
  await doc.loadInfo()
  const sheet = doc.sheetsByTitle['SPOS']
  await sheet.loadHeaderRow()
  await sheet.loadCells()
  let originalIndex = sheet.headerValues.indexOf('16/08')
  let currentIndex = originalIndex
  while (sheet.getCell(0, currentIndex).formattedValue.includes('16/08')) {
    currentIndex++
  }


  // Inserting new column
  sheet.insertDimension('COLUMNS', { startIndex: currentIndex, endIndex: currentIndex + 1 }, true)

  // Resetting cache
  sheet.resetLocalCache()
  await doc.loadInfo()
  await sheet.loadCells()

  sheet.getCell(0, currentIndex).value = `${sheet.getCell(0, originalIndex).formattedValue}-${currentIndex - originalIndex + 1}`
  const a1 = sheet.getCell(currentClass.lastRoll + 1, currentIndex).a1Column
  // Setting bottom formula
  sheet.getCell(currentClass.lastRoll + 1, currentIndex).formula = `=SUM(${a1}2:${a1}${currentClass.lastRoll})`

  await sheet.saveUpdatedCells()
  console.log("DONE")
  res.send("DONE")
})