export type UploadItem = {
  file: File;
  relativePath: string;
};

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, error: (err: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error: (err: DOMException) => void,
    ) => void;
  };
};

function readAllEntries(reader: {
  readEntries: (
    success: (entries: FileSystemEntryLike[]) => void,
    error: (err: DOMException) => void,
  ) => void;
}): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = [];

    const readBatch = () => {
      reader.readEntries(entries => {
        if (!entries.length) {
          resolve(all);
          return;
        }
        all.push(...entries);
        readBatch();
      }, reject);
    };

    readBatch();
  });
}

async function readEntry(entry: FileSystemEntryLike, parentPath: string): Promise<UploadItem[]> {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file!(resolve, reject);
    });
    return [{ file, relativePath: path }];
  }

  if (entry.isDirectory && entry.createReader) {
    const children = await readAllEntries(entry.createReader());
    const nested: UploadItem[] = [];
    for (const child of children) {
      nested.push(...await readEntry(child, path));
    }
    return nested;
  }

  return [];
}

export function itemsFromFileList(files: FileList | File[]): UploadItem[] {
  return Array.from(files).map(file => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }));
}

export async function itemsFromDataTransfer(dataTransfer: DataTransfer): Promise<UploadItem[]> {
  const entries = Array.from(dataTransfer.items)
    .map(item => item.webkitGetAsEntry?.() as FileSystemEntryLike | null)
    .filter((entry): entry is FileSystemEntryLike => Boolean(entry));

  if (!entries.length) {
    return itemsFromFileList(dataTransfer.files);
  }

  const items: UploadItem[] = [];
  for (const entry of entries) {
    items.push(...await readEntry(entry, ""));
  }
  return items;
}
