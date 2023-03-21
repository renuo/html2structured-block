const { JSDOM } = require('jsdom');

let root_structured_text_node = [];
let client = null;
let imageBlockId = null;

async function buildTree(nodes, is_root = false) {
  let structured_text_node = [];
  if (is_root) structured_text_node = root_structured_text_node;

  for (let i = 0; i < nodes.length; i++) {
    const child = nodes[i];
    if (child.nodeName == 'P') {
      res = await buildTree(child.childNodes);

      if (child.textContent.trim() == '') for (let j = 0; j < res.length; j++) structured_text_node.push(res[j]);
      else structured_text_node.push({ type: 'paragraph', children: res });
    } else if (/^H[1-6]$/.test(child.nodeName)) {
      if (child.textContent.trim() == '') continue;

      structured_text_node.push({
        type: 'heading',
        level: parseInt(child.nodeName.replace('H', '')),
        children: [{ type: 'span', marks: [], value: child.textContent.trim() }],
      });
    } else if (/^(#text|SPAN|SUP|TT|FONT)$/.test(child.nodeName)) {
      if (child.textContent.trim() == '') continue;

      child.textContent = child.textContent.replace(/(\r\n|\n|\r)/gm, '');
      structured_text_node.push({
        type: 'span', marks: [], value: child.textContent,
      });
    } else if (child.nodeName == 'A') {
      structured_text_node.push({
        type: 'link',
        url: child.href,
        children: [
          {
            type: 'span',
            marks: [],
            value: child.textContent,
          },
        ],
        meta: [{ id: 'target', value: '_blank' }],
      });
    } else if (/^(SMALL|STRONG|B|I|EM|U)$/.test(child.nodeName)) {
      if (child.textContent.trim() == '') continue;

      const mark = {
        SMALL: 'emphasis',
        I: 'emphasis',
        EM: 'emphasis',
        STRONG: 'strong',
        B: 'strong',
        U: 'underline',
      }[child.nodeName];

      child.textContent = child.textContent.replace(/(\r\n|\n|\r)/gm, '');
      structured_text_node.push({
        type: 'span',
        marks: [mark],
        value: child.textContent,
      });
    } else if (child.nodeName == 'IMG') {
      const uploadPhoto = await uploadToDatoCMS(child.src, client);
      if (uploadPhoto == null) {
        root_structured_text_node.push(await error_block(`Image upload failed: ${image_url}`));
        continue;
      }
      root_structured_text_node.push({
        item: {
          type: 'item',
          attributes: {
            image: uploadPhoto,
          },
          relationships: { item_type: { data: { id: imageBlockId, type: 'item_type' } } },
        },
        type: 'block',
      });
    } else if (child.nodeName == 'UL' || child.nodeName == 'OL') {
      const style = child.nodeName == 'OL' ? 'numbered' : 'bulleted';
      structured_text_node.push({
        type: 'list',
        children: await buildTree(child.childNodes),
        style,
      });
    } else if (child.nodeName == 'LI') {
      structured_text_node.push({
        type: 'listItem',
        children: [
          {
            children: await buildTree(child.childNodes),
            type: 'paragraph',
          },
        ],
      });
    } else if (child.nodeName == 'CODE' || child.nodeName == 'PRE') {
      root_structured_text_node.push({
        code: child.textContent,
        type: 'code',
      });
    } else if (child.nodeName == 'HR') {
      structured_text_node.push({ type: 'thematicBreak' });
    } else if (child.nodeName == 'BLOCKQUOTE') {
      const bC = await buildTree(child.childNodes);
      if (bC.length == 0) continue;
      structured_text_node.push({
        type: 'blockquote',
        children: [{ children: bC, type: 'paragraph' }],
      });
    } else if (child.nodeName == 'ASIDE') {
      structured_text_node.push({
        type: 'paragraph',
        children: await buildTree(child.childNodes),
      });
    } else {
      structured_text_node.push(await error_block(`Unknown node: ${child.nodeName}`));
    }

    const last_item = structured_text_node.length - 1;
    const non_root_blocks = ['span', 'link'];
    if (last_item >= 0 && is_root && non_root_blocks.includes(structured_text_node[last_item].type)) {
      structured_text_node.push({
        type: 'paragraph',
        children: [structured_text_node[last_item]],
      });
      structured_text_node.splice(last_item, 1);
    }
  }
  return structured_text_node;
}

async function error_block(error) {
  error = `${error.substring(0, 500)}...`;
  console.log(`!!!!!!!! Error !!!!!!!! ${error}`);
  return {
    type: 'paragraph',
    children: [{ type: 'span', marks: ['strong'], value: `!!!!!!!! Error !!!!!!!! ${error}` }],
  };
}

async function html2block(html, c = null, img = null) {
  if (!html) return { schema: 'dast', document: { type: 'root', children: [] } };

  client = c;
  imageBlockId = img;
  root_structured_text_node = [];
  elements_to_remove = ['div', 'main', 'br'];
  for (let i = 0; i < elements_to_remove.length; i++) {
    const element = elements_to_remove[i];
    html = html.replace(new RegExp(`<${element}.*?>`, 'g'), '');
    html = html.replace(new RegExp(`</${element}>`, 'g'), '');
  }
  const htmls = html.split('\n');

  new_html = '';
  for (let i = 0; i < htmls.length; i++) {
    const line = htmls[i];
    if (line.trim() == '') continue;
    if (line.startsWith('<') && line.endsWith('>')) {
      new_html += line;
      continue;
    }
    new_html = `${new_html}<p>${line}</p>`;
  }

  const dom = new JSDOM(`<!DOCTYPE html><body>${new_html}</body>`);
  const nodes = dom.window.document.body.childNodes;

  return { schema: 'dast', document: { type: 'root', children: await buildTree(nodes, true) } };
}

async function uploadToDatoCMS(image_url, client) {
  try {
    const uploadPhoto = await client.uploads.createFromUrl({
      url: image_url,
      skipCreationIfAlreadyExists: true,
    }).catch((e) => {
      console.log(e);
    });
    return {
      upload_id: uploadPhoto.id,
    };
  } catch (e) {
    console.log(e);
    return null;
  }
}

function boolToDatoCMS(bool) {
  return bool == 'true';
}

async function fetchRecords(type, field, value, client) {
  const records = await client.items.list({
    filter: {
      type,
      fields: { [field]: { eq: value } },
    },
    page: { limit: 100 },
    version: 'current',
  });

  return records;
}

exports.html2block = html2block;
exports.uploadToDatoCMS = uploadToDatoCMS;
exports.fetchRecords = fetchRecords;
exports.boolToDatoCMS = boolToDatoCMS;
