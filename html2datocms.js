const { JSDOM } = require('jsdom')

class HTML2DatoCMS {
  constructor (client, imageBlockId) {
    this.client = client
    this.imageBlockId = imageBlockId
  }

  async buildTree (nodes, isRoot = false) {
    let structuredTextNode = []
    if (isRoot) structuredTextNode = this.rootStructuredTextNode

    for (let i = 0; i < nodes.length; i++) {
      const child = nodes[i]
      if (child.nodeName === 'P') {
        const res = await this.buildTree(child.childNodes)

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
        const uploadPhoto = await this.uploadToDatoCMS(child.src)
        if (uploadPhoto === null) {
          this.rootStructuredTextNode.push(await this.errorBlock(`Image upload failed: ${child.src}`))
          continue
        }
        this.rootStructuredTextNode.push({
          item: {
            type: 'item',
            attributes: {
              image: uploadPhoto
            },
            relationships: { item_type: { data: { id: this.imageBlockId, type: 'item_type' } } }
          },
          type: 'block'
        })
      } else if (child.nodeName === 'UL' || child.nodeName === 'OL') {
        const style = child.nodeName === 'OL' ? 'numbered' : 'bulleted'
        structuredTextNode.push({
          type: 'list',
          children: await this.buildTree(child.childNodes),
          style
        })
      } else if (child.nodeName === 'LI') {
        structuredTextNode.push({
          type: 'listItem',
          children: [
            {
              children: await this.buildTree(child.childNodes),
              type: 'paragraph'
            }
          ]
        })
      } else if (child.nodeName === 'CODE' || child.nodeName === 'PRE') {
        this.rootStructuredTextNode.push({
          code: child.textContent,
          type: 'code'
        })
      } else if (child.nodeName === 'HR') {
        structuredTextNode.push({ type: 'thematicBreak' })
      } else if (child.nodeName === 'BLOCKQUOTE') {
        const quote = await this.buildTree(child.childNodes)
        if (quote.length === 0) continue
        structuredTextNode.push({
          type: 'blockquote',
          children: [{ children: quote, type: 'paragraph' }]
        })
      } else if (child.nodeName === 'ASIDE') {
        structuredTextNode.push({
          type: 'paragraph',
          children: await this.buildTree(child.childNodes)
        })
      } else {
        structuredTextNode.push(await this.errorBlock(`Unknown node: ${child.nodeName}`))
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

  async errorBlock (error) {
    error = `${error.substring(0, 500)}...`
    console.log(`!!!!!!!! Error !!!!!!!! ${error}`)
    return {
      type: 'paragraph',
      children: [{ type: 'span', marks: ['strong'], value: `!!!!!!!! Error !!!!!!!! ${error}` }]
    }
  }

  addRootNode (node) {
    return { schema: 'dast', document: { type: 'root', children: node } }
  }

  async html2block (html) {
    if (!html) return this.addRootNode([])

    this.rootStructuredTextNode = []

    const elementsToRemove = ['div', 'main', 'br']
    for (let i = 0; i < elementsToRemove.length; i++) {
      const element = elementsToRemove[i]
      html = html.replace(new RegExp(`<${element}.*?>`, 'g'), '')
      html = html.replace(new RegExp(`</${element}>`, 'g'), '')
    }
    const htmls = html.split('\n')

    let newHtml = ''
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

    return this.addRootNode(await this.buildTree(nodes, true))
  }

  async uploadToDatoCMS (imageUrl) {
    try {
      const uploadPhoto = await this.client.uploads.createFromUrl({
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

  boolToDatoCMS (bool) {
    return bool === 'true'
  }

  async fetchRecords (type, field, value) {
    const records = await this.client.items.list({
      filter: {
        type,
        fields: { [field]: { eq: value } }
      },
      page: { limit: 100 },
      version: 'current'
    })

    return records
  }
}
exports.HTML2DatoCMS = HTML2DatoCMS
