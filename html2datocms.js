const { JSDOM } = require('jsdom')

let rootStructuredTextNode = []
let client = null
let imageBlockId = null

async function buildTree (nodes, isRoot = false) {
  let structuredTextNode = []
  if (isRoot) structuredTextNode = rootStructuredTextNode

  for (let i = 0; i < nodes.length; i++) {
    const child = nodes[i]
    if (child.nodeName === 'P') {
      res = await buildTree(child.childNodes)

      if (child.textContent.trim() === '') for (let j = 0; j < res.length; j++) structuredTextNode.push(res[j])
      else structuredTextNode.push({ type: 'paragraph', children: res })
    } else if (/^H[1-6]$/.test(child.nodeName)) {
      if (child.textContent.trim() === '') continue

      structuredTextNode.push({
        type: 'heading',
        level: parseInt(child.nodeName.replace('H', '')),
        children: [{ type: 'span', marks: [], value: child.textContent.trim() }]
      })
    } else if (/^(#text|SPAN|SUP|TT|FONT)$/.test(child.nodeName)) {
      if (child.textContent.trim() === '') continue

      child.textContent = child.textContent.replace(/(\r\n|\n|\r)/gm, '')
      structuredTextNode.push({
        type: 'span', marks: [], value: child.textContent
      })
    } else if (child.nodeName === 'A') {
      structuredTextNode.push({
        type: 'link',
        url: child.href,
        children: [
          {
            type: 'span',
            marks: [],
            value: child.textContent
          }
        ],
        meta: [{ id: 'target', value: '_blank' }]
      })
    } else if (/^(SMALL|STRONG|B|I|EM|U)$/.test(child.nodeName)) {
      if (child.textContent.trim() === '') continue

      const mark = {
        SMALL: 'emphasis',
        I: 'emphasis',
        EM: 'emphasis',
        STRONG: 'strong',
        B: 'strong',
        U: 'underline'
      }[child.nodeName]

      child.textContent = child.textContent.replace(/(\r\n|\n|\r)/gm, '')
      structuredTextNode.push({
        type: 'span',
        marks: [mark],
        value: child.textContent
      })
    } else if (child.nodeName === 'IMG') {
      const uploadPhoto = await uploadToDatoCMS(child.src, client)
      if (uploadPhoto === null) {
        rootStructuredTextNode.push(await errorBlock(`Image upload failed: ${imageUrl}`))
        continue
      }
      rootStructuredTextNode.push({
        item: {
          type: 'item',
          attributes: {
            image: uploadPhoto
          },
          relationships: { item_type: { data: { id: imageBlockId, type: 'item_type' } } }
        },
        type: 'block'
      })
    } else if (child.nodeName === 'UL' || child.nodeName === 'OL') {
      const style = child.nodeName === 'OL' ? 'numbered' : 'bulleted'
      structuredTextNode.push({
        type: 'list',
        children: await buildTree(child.childNodes),
        style
      })
    } else if (child.nodeName === 'LI') {
      structuredTextNode.push({
        type: 'listItem',
        children: [
          {
            children: await buildTree(child.childNodes),
            type: 'paragraph'
          }
        ]
      })
    } else if (child.nodeName === 'CODE' || child.nodeName === 'PRE') {
      rootStructuredTextNode.push({
        code: child.textContent,
        type: 'code'
      })
    } else if (child.nodeName === 'HR') {
      structuredTextNode.push({ type: 'thematicBreak' })
    } else if (child.nodeName === 'BLOCKQUOTE') {
      const bC = await buildTree(child.childNodes)
      if (bC.length === 0) continue
      structuredTextNode.push({
        type: 'blockquote',
        children: [{ children: bC, type: 'paragraph' }]
      })
    } else if (child.nodeName === 'ASIDE') {
      structuredTextNode.push({
        type: 'paragraph',
        children: await buildTree(child.childNodes)
      })
    } else {
      structuredTextNode.push(await errorBlock(`Unknown node: ${child.nodeName}`))
    }

    const lastItem = structuredTextNode.length - 1
    const nonRootBlocks = ['span', 'link']
    if (lastItem >= 0 && isRoot && nonRootBlocks.includes(structuredTextNode[lastItem].type)) {
      structuredTextNode.push({
        type: 'paragraph',
        children: [structuredTextNode[lastItem]]
      })
      structuredTextNode.splice(lastItem, 1)
    }
  }
  return structuredTextNode
}

async function errorBlock (error) {
  error = `${error.substring(0, 500)}...`
  console.log(`!!!!!!!! Error !!!!!!!! ${error}`)
  return {
    type: 'paragraph',
    children: [{ type: 'span', marks: ['strong'], value: `!!!!!!!! Error !!!!!!!! ${error}` }]
  }
}

async function html2block (html, c = null, img = null) {
  if (!html) return { schema: 'dast', document: { type: 'root', children: [] } }

  client = c
  imageBlockId = img
  rootStructuredTextNode = []
  elementsToRemove = ['div', 'main', 'br']
  for (let i = 0; i < elementsToRemove.length; i++) {
    const element = elementsToRemove[i]
    html = html.replace(new RegExp(`<${element}.*?>`, 'g'), '')
    html = html.replace(new RegExp(`</${element}>`, 'g'), '')
  }
  const htmls = html.split('\n')

  newHtml = ''
  for (let i = 0; i < htmls.length; i++) {
    const line = htmls[i]
    if (line.trim() === '') continue
    if (line.startsWith('<') && line.endsWith('>')) {
      newHtml += line
      continue
    }
    newHtml = `${newHtml}<p>${line}</p>`
  }

  const dom = new JSDOM(`<!DOCTYPE html><body>${newHtml}</body>`)
  const nodes = dom.window.document.body.childNodes

  return { schema: 'dast', document: { type: 'root', children: await buildTree(nodes, true) } }
}

async function uploadToDatoCMS (imageUrl, client) {
  try {
    const uploadPhoto = await client.uploads.createFromUrl({
      url: imageUrl,
      skipCreationIfAlreadyExists: true
    }).catch((e) => {
      console.log(e)
    })
    return {
      upload_id: uploadPhoto.id
    }
  } catch (e) {
    console.log(e)
    return null
  }
}

function boolToDatoCMS (bool) {
  return bool === 'true'
}

async function fetchRecords (type, field, value, client) {
  const records = await client.items.list({
    filter: {
      type,
      fields: { [field]: { eq: value } }
    },
    page: { limit: 100 },
    version: 'current'
  })

  return records
}

exports.html2block = html2block
exports.uploadToDatoCMS = uploadToDatoCMS
exports.fetchRecords = fetchRecords
exports.boolToDatoCMS = boolToDatoCMS
