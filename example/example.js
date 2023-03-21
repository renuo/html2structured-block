const { HTML2DatoCMS } = require('../html2datocms.js')
const { buildClient } = require('@datocms/cma-client-node')

DATO_ITEM_TYPE_ID = 'YOUR_ITEM_TYPE_ID'
DATO_IMG_BLOCK_ID = 'YOUR_IMG_BLOCK_ID'
DATO_API_TOKEN = 'YOUR_API_TOKEN'

async function example () {
  const exampleData = {
    title: 'Example Title',
    active: 'true',
    image: 'https://picsum.photos/200/300',
    // text with translations
    description: '<p><strong>Bold Text</strong>, <i>Italic Text</i> and <u>Underlined Text</u></p>',
    translations: {
      'de-CH': {
        description: '<p><strong>Fett Text</strong>, <i>Kursiv Text</i> und <u>Unterstrichener Text</u></p>'
      }
    },
    // text with images
    description_img: '<p><strong>Bold Text</strong>, <i>Italic Text</i> und <u>Underlined Text</u></p><img src="https://picsum.photos/200/300" alt="Image Alt Text" />',
    categories: ['Events', 'News']
  }

  const client = buildClient({ apiToken: DATO_API_TOKEN })

  const h2d = new HTML2DatoCMS(client, DATO_IMG_BLOCK_ID)

  // check if item already exists (assuming title is unique)
  const records = await h2d.fetchRecords('my_item', 'title', exampleData.title)
  if (records.length > 0) {
    console.log('Item already exists!')
    return
  }

  datoCategories = []
  for (let i = 0; i < exampleData.categories.length; i++) {
    const category = exampleData.categories[i]
    const records = await h2d.fetchRecords('category', 'name', category, client)

    if (records.length > 0) datoCategories.push(records[0].id.toString())
    else console.log('Category ' + category + ' not found!')
  }

  const datoItem = {
    item_type: { type: 'item_type', id: DATO_ITEM_TYPE_ID },
    title: exampleData.title,
    description: {
      en: await h2d.html2block(exampleData.description),
      'de-CH': await h2d.html2block(exampleData.translations['de-CH'].description)
    },
    // client is needed for uploading images
    description_img: await h2d.html2block(exampleData.description_img),
    active: h2d.boolToDatoCMS(exampleData.active),
    image: await h2d.uploadToDatoCMS(exampleData.image),
    categories: datoCategories
  }

  await client.items.create(datoItem).catch((e) => {
    console.log(e)

    // To inspect the item if something is wrong
    const fs = require('fs')
    fs.writeFile('example_dato_item.json', JSON.stringify(datoItem), function () { })

    console.log('Error while creating item. Check example_dato_item.json')
  })
}

example()
