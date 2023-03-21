const { html2block, boolToDatoCMS, fetchRecords, uploadToDatoCMS } = require('./html2datocms.js');

const clientMock = {
    uploads: { createFromUrl: jest.fn() },
    items: { list: jest.fn() },
};


function add_root_node(structured_text_node) {
    return {
        schema: 'dast',
        document: {
            type: 'root',
            children: structured_text_node,
        },
    };
}

test('converts heading tags to structured text', async () => {
    const html = '<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3><h4>Heading 4</h4><h5>Heading 5</h5><h6>Heading 6</h6>';
    const structured_text = await html2block(html);

    const expected_children = [];
    for (let level = 1; level <= 6; level++) {
        expected_children.push({ type: 'heading', level: level, children: [{ marks: [], type: 'span', value: `Heading ${level}` }], });
    }

    expect(structured_text).toStrictEqual(add_root_node(expected_children));
});


test('converts link tags to structured text', async () => {
    const html = '<a href="https://www.example.com/">Example Link</a>';
    const structured_text = await html2block(html);
    expect(structured_text).toStrictEqual(
        add_root_node([{
            type: 'paragraph',
            children: [
                {
                    type: 'link', url: 'https://www.example.com/',
                    children: [{ type: 'span', marks: [], value: 'Example Link' }], meta: [{ id: 'target', value: '_blank' }]
                },
            ],
        },])
    );
});

test('converts bold, italic, and underline tags to structured text', async () => {
    const html = '<p><strong>Bold Text</strong><i>Italic Text</i><u>Underlined Text</u></p>';
    const structured_text = await html2block(html);
    expect(structured_text).toStrictEqual(
        add_root_node([{
            type: 'paragraph',
            children: [
                { type: 'span', marks: ['strong'], value: 'Bold Text' },
                { type: 'span', marks: ['emphasis'], value: 'Italic Text' },
                { type: 'span', marks: ['underline'], value: 'Underlined Text' },
            ],
        },])
    );
});

test('converts list tags to structured text', async () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>Item 1</li><li>Item 2</li></ol>';
    const structured_text = await html2block(html);
    expect(structured_text).toStrictEqual(
        add_root_node([
            {
                type: 'list',
                style: 'bulleted',
                children: [
                    { type: 'listItem', children: [{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Item 1', },], },], },
                    { type: 'listItem', children: [{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Item 2', },], },], },
                ],
            },
            {
                type: 'list',
                style: 'numbered',
                children: [
                    { type: 'listItem', children: [{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Item 1', },], },], },
                    { type: 'listItem', children: [{ type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Item 2', },], },], },
                ],
            },
        ])
    );
});


test('converts <code> tag to structured text', async () => {
    const html = '<code>console.log("Hello, World!");</code>';
    const structured_text = await html2block(html);
    expect(structured_text).toStrictEqual(
        add_root_node([{ type: 'code', code: 'console.log("Hello, World!");' }])
    );
});

test('converts <hr> tag to structured text', async () => {
    const html = '<hr>';
    const structured_text = await html2block(html);
    expect(structured_text).toStrictEqual(
        add_root_node([{ type: 'thematicBreak', },])
    );
});

test('converts <aside> tag to structured text', async () => {
    const html = '<p><aside>Example aside text</aside></p>';
    const structured_text = await html2block(html);
    expect(structured_text).toStrictEqual(
        add_root_node([
            { type: 'paragraph', children: [{ marks: [], type: 'span', value: 'Example aside text' }] }
        ])
    );
});

test('handles unknown tag and generates error block', async () => {
    const html = '<unknown>Unknown content</unknown>';
    const structured_text = await html2block(html);
    expect(structured_text).toMatchObject(
        add_root_node([{
            type: 'paragraph',
            children: [
                { type: 'span', marks: ['strong'], value: expect.stringContaining('!!!!!!!! Error !!!!!!!! Unknown node: UNKNOWN') },
            ],
        },])
    );
});


test('converts <img> tag to structured text', async () => {
    clientMock.uploads.createFromUrl.mockResolvedValue({ id: 'mock_image_id' });

    const html = '<img src="https://example.com/image.jpg" alt="Example image">';
    const sample_block_id = '123456';
    const structured_text = await html2block(html, clientMock, sample_block_id);

    expect(structured_text).toStrictEqual(
        add_root_node([
            {
                type: 'block',
                item: {
                    type: 'item',
                    attributes: { image: { upload_id: 'mock_image_id' } },
                    relationships: { item_type: { data: { id: sample_block_id, type: 'item_type' } } },
                },
            },
        ])
    );

    expect(clientMock.uploads.createFromUrl).toHaveBeenCalledWith({
        url: 'https://example.com/image.jpg',
        skipCreationIfAlreadyExists: true,
    });
});

test('boolToDatoCMS converts string boolean values to boolean', () => {
    expect(boolToDatoCMS('true')).toBe(true);
    expect(boolToDatoCMS('false')).toBe(false);
});


test('uploadToDatoCMS uploads image and returns upload id', async () => {
    clientMock.uploads.createFromUrl.mockResolvedValue({ id: 'mock_image_id' });

    const imageUrl = 'https://example.com/image.jpg';
    const result = await uploadToDatoCMS(imageUrl, clientMock);

    expect(result).toStrictEqual({ upload_id: 'mock_image_id' });
    expect(clientMock.uploads.createFromUrl).toHaveBeenCalledWith({
        url: imageUrl,
        skipCreationIfAlreadyExists: true,
    });
});

test('fetchRecords fetches records from DatoCMS', async () => {
    const mockRecords = [{ id: 'record1' }, { id: 'record2' }];
    clientMock.items.list.mockResolvedValue(mockRecords);

    const type = 'sample_type';
    const field = 'sample_field';
    const value = 'sample_value';

    const records = await fetchRecords(type, field, value, clientMock);

    expect(records).toStrictEqual(mockRecords);
    expect(clientMock.items.list).toHaveBeenCalledWith({
        filter: {
            type: type,
            fields: { [field]: { eq: value } },
        },
        page: { limit: 100 },
        version: 'current',
    });
});

