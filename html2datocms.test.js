const { HTML2DatoCMS } = require('./html2datocms.js')

function addRootNode(structuredTextNode) {
  return {
    schema: 'dast',
    document: {
      type: 'root',
      children: structuredTextNode
    }
  }
}

test('converts heading tags to structured text', async () => {
  const html = '<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3><h4>Heading 4</h4><h5>Heading 5</h5><h6>Heading 6</h6>'
  const structuredText = await new HTML2DatoCMS().html2block(html)

  const expectedChildren = []
  for (let level = 1; level <= 6; level++) {
    expectedChildren.push({ type: 'heading', level, children: [{ marks: [], type: 'span', value: `Heading ${level}` }] })
  }

  expect(structuredText).toStrictEqual(addRootNode(expectedChildren))
})

test('converts link tags to structured text', async () => {
  const html = '<a href="https://www.example.com/">Example Link</a>'
  const structuredText = await new HTML2DatoCMS().html2block(html)
  expect(structuredText).toStrictEqual(
    addRootNode([{
      type: 'paragraph',
      children: [
        {
          type: 'link',
          url: 'https://www.example.com/',
          children: [{ type: 'span', marks: [], value: 'Example Link' }],
          meta: [{ id: 'target', value: '_blank' }]
        }
      ]
    }])
  )
})

test('converts bold, italic, and underline tags to structured text', async () => {
  const html = '<p><strong>Bold Text</strong><i>Italic Text</i><u>Underlined Text</u></p>'
  const structuredText = await new HTML2DatoCMS().html2block(html)
  expect(structuredText).toStrictEqual(
    addRootNode([{
      type: 'paragraph',
      children: [
        { type: 'span', marks: ['strong'], value: 'Bold Text' },
        { type: 'span', marks: ['emphasis'], value: 'Italic Text' },
        { type: 'span', marks: ['underline'], value: 'Underlined Text' }
      ]
    }])
  )
})

test('converts list tags to structured text', async () => {
  const html = '<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>Item 1</li><li>Item 2</li></ol>'
  const structuredText = await new HTML2DatoCMS().html2block(html)
  expect(structuredText).toStrictEqual(
    addRootNode([
      {
        type: 'list',
        style: 'bulleted',
        children: [
          { type: 'listItem', children: [{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Item 1' }] }] },
          { type: 'listItem', children: [{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Item 2' }] }] }
        ]
      },
      {
        type: 'list',
        style: 'numbered',
        children: [
          { type: 'listItem', children: [{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Item 1' }] }] },
          { type: 'listItem', children: [{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Item 2' }] }] }
        ]
      }
    ])
  )
})

test('converts <code> tag to structured text', async () => {
  const html = '<code>console.log("Hello, World!");</code>'
  const structuredText = await new HTML2DatoCMS().html2block(html)
  expect(structuredText).toStrictEqual(
    addRootNode([{ type: 'code', code: 'console.log("Hello, World!");' }])
  )
})

test('converts <hr> tag to structured text', async () => {
  const html = '<hr>'
  const structuredText = await new HTML2DatoCMS().html2block(html)
  expect(structuredText).toStrictEqual(
    addRootNode([{ type: 'thematicBreak' }])
  )
})

test('converts <aside> tag to structured text', async () => {
  const html = '<p><aside>Example aside text</aside></p>'
  const structuredText = await new HTML2DatoCMS().html2block(html)
  expect(structuredText).toStrictEqual(
    addRootNode([
      { type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Example aside text' }] }
    ])
  )
})

test('handles unknown tag and generates error block', async () => {
  const html = '<unknown>Unknown content</unknown>'
  const structuredText = await new HTML2DatoCMS().html2block(html)
  expect(structuredText).toMatchObject(
    addRootNode([{
      type: 'paragraph',
      children: [
        { type: 'span', marks: ['strong'], value: expect.stringContaining('!!!!!!!! Error !!!!!!!! Unknown node: UNKNOWN') }
      ]
    }])
  )
})

test('converts <img> tag to structured text', async () => {
  const clientMock = { uploads: { createFromUrl: jest.fn() } }
  clientMock.uploads.createFromUrl.mockResolvedValue({ id: 'mock_image_id' })

  const html = '<img src="https://example.com/image.jpg" alt="Example image">'
  const sampleBlockId = '123456'
  const structuredText = await new HTML2DatoCMS(clientMock, sampleBlockId).html2block(html)

  expect(structuredText).toStrictEqual(
    addRootNode([
      {
        type: 'block',
        item: {
          type: 'item',
          attributes: { image: { upload_id: 'mock_image_id' } },
          relationships: { item_type: { data: { id: sampleBlockId, type: 'item_type' } } }
        }
      }
    ])
  )

  expect(clientMock.uploads.createFromUrl).toHaveBeenCalledWith({
    url: 'https://example.com/image.jpg',
    skipCreationIfAlreadyExists: true
  })
})

test(`handles <img> tag without 'src' attribute and generates error block`, async () => {
  const html = '<img alt="Example image">'
  const structuredText = await new HTML2DatoCMS().html2block(html)
  expect(structuredText).toMatchObject(
    addRootNode([{
      type: 'paragraph',
      children: [
        { type: 'span', marks: ['strong'], value: expect.stringContaining('!!!!!!!! Error !!!!!!!! Image upload failed: ...') }
      ]
    }])
  )
})

test(`handles <img> tag with broken 'src' attribute and generates error block`, async () => {
  const html = '<img src="https://example.com/image.jpg" alt="Example image">'
  const structuredText = await new HTML2DatoCMS().html2block(html)
  expect(structuredText).toMatchObject(
    addRootNode([{
      type: 'paragraph',
      children: [
        { type: 'span', marks: ['strong'], value: expect.stringContaining('!!!!!!!! Error !!!!!!!! Image upload failed: https://example.com/image.jpg...') }
      ]
    }])
  )
})

test('boolToDatoCMS converts string boolean values to boolean', () => {
  expect(new HTML2DatoCMS().boolToDatoCMS('true')).toBe(true)
  expect(new HTML2DatoCMS().boolToDatoCMS('false')).toBe(false)
})

test('uploadToDatoCMS uploads image and returns upload id', async () => {
  const clientMock = { uploads: { createFromUrl: jest.fn() } }
  clientMock.uploads.createFromUrl.mockResolvedValue({ id: 'mock_image_id' })

  const imageUrl = 'https://example.com/image.jpg'
  const result = await new HTML2DatoCMS(clientMock).uploadToDatoCMS(imageUrl)

  expect(result).toStrictEqual({ upload_id: 'mock_image_id' })
  expect(clientMock.uploads.createFromUrl).toHaveBeenCalledWith({
    url: imageUrl,
    skipCreationIfAlreadyExists: true
  })
})

test('fetchRecords fetches records from DatoCMS', async () => {
  const clientMock = { items: { list: jest.fn() } }
  const mockRecords = [{ id: 'record1' }, { id: 'record2' }]
  clientMock.items.list.mockResolvedValue(mockRecords)

  const type = 'sample_type'
  const field = 'sample_field'
  const value = 'sample_value'

  const records = await new HTML2DatoCMS(clientMock).fetchRecords(type, field, value)

  expect(records).toStrictEqual(mockRecords)
  expect(clientMock.items.list).toHaveBeenCalledWith({
    filter: {
      type,
      fields: { [field]: { eq: value } }
    },
    page: { limit: 100 },
    version: 'current'
  })
})

test('using same instance of HTML2DatoCMS for multiple conversions', async () => {
  const clientMock = { uploads: { createFromUrl: jest.fn() } }
  clientMock.uploads.createFromUrl.mockResolvedValue({ id: 'mock_image_id' })

  const sampleBlockId = '123456'
  const html2DatoCMS = new HTML2DatoCMS(clientMock, sampleBlockId)
  const html = '<p>Example text</p>'
  const structuredText = await html2DatoCMS.html2block(html)
  expect(structuredText).toStrictEqual(
    addRootNode([{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Example text' }] }])
  )

  const html2 = '<p>Example text 2</p>'
  const structuredText2 = await html2DatoCMS.html2block(html2)
  expect(structuredText2).toStrictEqual(
    addRootNode([{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Example text 2' }] }])
  )

  expect(clientMock.uploads.createFromUrl).toHaveBeenCalledTimes(0)

  const html3 = '<img src="https://example.com/image.jpg" alt="Example image">'
  const structuredText3 = await html2DatoCMS.html2block(html3)
  expect(structuredText3).toStrictEqual(
    addRootNode([{ type: 'block', item: { type: 'item', attributes: { image: { upload_id: 'mock_image_id' } }, relationships: { item_type: { data: { id: sampleBlockId, type: 'item_type' } } } } }])
  )

  expect(clientMock.uploads.createFromUrl).toHaveBeenCalledTimes(1)

  const img = "https://example.com/image.jpg"
  const uploadId = await html2DatoCMS.uploadToDatoCMS(img)
  expect(uploadId).toStrictEqual({ upload_id: 'mock_image_id' })

  expect(clientMock.uploads.createFromUrl).toHaveBeenCalledTimes(2)
})
