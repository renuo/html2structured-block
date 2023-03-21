const { html2block, boolToDatoCMS, fetchRecords, uploadToDatoCMS } = require('../html2datocms.js');
const { buildClient } = require('@datocms/cma-client-node');

DATO_ITEM_TYPE_ID = 'YOUR_ITEM_TYPE_ID'
DATO_IMG_BLOCK_ID = 'YOUR_IMG_BLOCK_ID'
DATO_API_TOKEN = 'YOUR_API_TOKEN'

async function example() {
    const example_data = {
        "title": "Example Title",
        "active": "true",
        "image": "https://picsum.photos/200/300",
        // text with translations
        "description": "<p><strong>Bold Text</strong>, <i>Italic Text</i> and <u>Underlined Text</u></p>",
        "translations": {
            "de-CH": {
                "description": "<p><strong>Fett Text</strong>, <i>Kursiv Text</i> und <u>Unterstrichener Text</u></p>",
            },
        },
        // text with images
        "description_img": "<p><strong>Bold Text</strong>, <i>Italic Text</i> und <u>Underlined Text</u></p><img src=\"https://picsum.photos/200/300\" alt=\"Image Alt Text\" />",
        "categories": ["Events", "News"]
    };

    const client = buildClient({ apiToken: DATO_API_TOKEN });

    // check if item already exists (assuming title is unique)
    var records = await fetchRecords("my_item", "title", example_data.title, client);
    if (records.length > 0) {
        console.log("Item already exists!");
        return;
    }

    dato_categories = []
    for (let i = 0; i < example_data.categories.length; i++) {
        const category = example_data.categories[i];
        var records = await fetchRecords("category", "name", category, client);

        if (records.length > 0) dato_categories.push(records[0].id.toString());
        else console.log("Category " + category + " not found!");
    }

    const dato_item = {
        item_type: { type: 'item_type', id: DATO_ITEM_TYPE_ID },
        title: example_data.title,
        description: {
            "en": await html2block(example_data.description),
            "de-CH": await html2block(example_data.translations["de-CH"].description),
        },
        // client is needed for uploading images
        description_img: await html2block(example_data.description_img, client, DATO_IMG_BLOCK_ID),
        active: boolToDatoCMS(example_data.active),
        image: await uploadToDatoCMS(example_data.image, client),
        categories: dato_categories,
    };

    await client.items.create(dato_item).catch((e) => {
        console.log(e);

        // To inspect the item if something is wrong
        const fs = require('fs');
        fs.writeFile('example_dato_item.json', JSON.stringify(dato_item), function () { });

        console.log("Error while creating item. Check example_dato_item.json");
    });
}

example();
