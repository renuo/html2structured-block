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


## Custom Tags

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

**Handling Unknown HTML Tags**

This project is designed to handle a variety of common HTML tags and convert them into structured text.
However, there may be cases where the code encounters an unknown or unsupported HTML tag.
In such scenarios, the code has a specific mechanism to manage these unknown tags.

When the code identifies an unknown HTML tag, it generates an error block containing a message about the encountered issue.
This error block takes the form of a paragraph with a strong emphasis style.
The message will include `!!!!!!!! Error !!!!!!!!` followed by a brief description of the problem, such as `Unknown node: ` and the name of the unknown tag.

By generating an error block for each unknown tag, the code provides a clear indication of any issues encountered during the conversion process. This allows you to review the output in DatoCMS and identify any problematic tags that require manual intervention or adjustments to the code for proper handling.

If you need to extend the support for additional HTML tags, you can modify the code in the `buildTree` function accordingly, by adding new conditions or adjusting the existing ones to manage the new tags as needed.

See [html2datocms.js](html2datocms.js) for more details.
