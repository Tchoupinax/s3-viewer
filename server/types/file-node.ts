import { S3ViewerDocument } from "~/server/types/document";

export type FileNode = {
  children?: Array<FileNode>;
  fullPath: string;
  isFolder: boolean;
  lastModified: Date | null;
  level: number;
  name: string;
  size: number;
};

export function buildFileTree(
  documents: Array<S3ViewerDocument>,
): Array<FileNode> {
  const root: Array<FileNode> = [];

  for (const document of documents) {
    const parts = document.name.split("/");
    let currentLevel = root;
    let currentPath = "";

    if (parts) {
      for (const [index, part] of parts.entries()) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let existingNode = currentLevel.find((node) => node.name === part);

        if (!existingNode) {
          existingNode = {
            name: part,
            level: index + 1,
            fullPath: currentPath,
            isFolder: index < parts.length - 1,
            size: document.size ?? 0,
            lastModified: document.lastModified,
          };

          if (index < parts.length - 1) {
            existingNode.children = [];
          }
          currentLevel.push(existingNode);
        }

        if (existingNode.children) {
          currentLevel = existingNode.children;
        }
      }
    }
  }

  function finalizeIsFolder(nodes: Array<FileNode>) {
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        node.isFolder = true;
        node.size = node.children.reduce((acc, cur) => acc + cur.size, 0);
        finalizeIsFolder(node.children);
      }
    }
  }

  finalizeIsFolder(root);

  return root;
}
