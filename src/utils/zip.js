const encoder = new TextEncoder();

export function buildZip(fileMap) {
  const files = [
    { name: "docs/README.md", content: fileMap.readme },
  ];

  const now = new Date();
  const dosTime = dateToDosTime(now);
  const dosDate = dateToDosDate(now);

  let centralDirectorySize = 0;
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content || "");
    const crc = crc32(dataBytes);
    const localHeader = createLocalFileHeader({
      nameBytes,
      dataBytes,
      crc,
      dosDate,
      dosTime,
    });

    localParts.push(localHeader, nameBytes, dataBytes);
    const localSize = localHeader.length + nameBytes.length + dataBytes.length;

    const centralHeader = createCentralDirectoryHeader({
      nameBytes,
      dataBytes,
      crc,
      dosDate,
      dosTime,
      offset,
    });

    centralParts.push(centralHeader, nameBytes);
    centralDirectorySize += centralHeader.length + nameBytes.length;
    offset += localSize;
  });

  const centralOffset = offset;
  const endRecord = createEndOfCentralDirectory({
    fileCount: files.length,
    centralDirectorySize,
    centralOffset,
  });

  const totalSize =
    offset + centralDirectorySize + endRecord.length;
  const zipBuffer = new Uint8Array(totalSize);

  let pointer = 0;

  [...localParts, ...centralParts, endRecord].forEach((part) => {
    zipBuffer.set(part, pointer);
    pointer += part.length;
  });

  const blob = new Blob([zipBuffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);

  return { blob, url };
}

function createLocalFileHeader({ nameBytes, dataBytes, crc, dosDate, dosTime }) {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true); // version needed
  view.setUint16(6, 0, true); // general purpose flag
  view.setUint16(8, 0, true); // compression method (store)
  view.setUint16(10, dosTime, true);
  view.setUint16(12, dosDate, true);
  view.setUint32(14, crc >>> 0, true);
  view.setUint32(18, dataBytes.length, true);
  view.setUint32(22, dataBytes.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true); // extra field length

  return header;
}

function createCentralDirectoryHeader({
  nameBytes,
  dataBytes,
  crc,
  dosDate,
  dosTime,
  offset,
}) {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true); // version made by
  view.setUint16(6, 20, true); // version needed
  view.setUint16(8, 0, true); // general purpose flag
  view.setUint16(10, 0, true); // compression method
  view.setUint16(12, dosTime, true);
  view.setUint16(14, dosDate, true);
  view.setUint32(16, crc >>> 0, true);
  view.setUint32(20, dataBytes.length, true);
  view.setUint32(24, dataBytes.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true); // extra length
  view.setUint16(32, 0, true); // file comment length
  view.setUint16(34, 0, true); // disk number start
  view.setUint16(36, 0, true); // internal attrs
  view.setUint32(38, 0, true); // external attrs
  view.setUint32(42, offset, true); // relative offset

  return header;
}

function createEndOfCentralDirectory({ fileCount, centralDirectorySize, centralOffset }) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true); // number of this disk
  view.setUint16(6, 0, true); // disk with start of central directory
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true); // comment length

  return record;
}

function dateToDosTime(date) {
  return (
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2)
  );
}

function dateToDosDate(date) {
  return (
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate()
  );
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = -1;

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

let crcTableCache = null;
function getCrcTable() {
  if (crcTableCache) {
    return crcTableCache;
  }

  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[i] = c >>> 0;
  }

  crcTableCache = table;
  return table;
}
