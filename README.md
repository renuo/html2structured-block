# HTML to DatoCMS Structured Text Converter

This project provides a utility to convert HTML content into structured text format, which can be used with DatoCMS.
The converter handles various HTML elements and converts them into appropriate structured text blocks and inline elements.

**How to Run**

Install the required dependencies:
```bash
npm install
```

Include the module in your project:
```javascript
const html2block = require('./html2datocms.js').html2block;
```

Use the html2block function to convert HTML content to structured text:
```javascript
const html = '<p>Example HTML content</p>';
const structured_text = await html2block(html);
```

**How to Test**

Run the test suite:
```bash
npm test
```

This will run the tests defined in the `html2datocms.test.js` file.

## DatoCMS

**Setting up the Client**

Install the DatoCMS client package:
```bash
npm install @datocms/cma-client-node
```

Import the `buildClient` function from the DatoCMS client package:
```javascript
const buildClient = require('@datocms/cma-client-node').buildClient;
```

Create the DatoCMS client using your API token:

```javascript
const client = buildClient({ apiToken: 'YOUR_API_TOKEN' });
```

Replace `YOUR_API_TOKEN` with your actual DatoCMS API token.

Now you can use the DatoCMS client with the functions provided in the `html2datocms.js` module, such as `uploadToDatoCMS` and `fetchRecords`.

**IMG-Tags/Image Block**

For `<img>`-Tags, you need to add a custom Block to DatoCMS.

You will need to fetch the appropriate image block ID from your own DatoCMS account.
To obtain the correct image block ID, navigate to your DatoCMS project's settings.

Go to:
- Blocks Library
- Create a Block called for example `Image Block`
- Copy the `Model ID`

```javascript
result = await html2block(html, client, model_id);
```

