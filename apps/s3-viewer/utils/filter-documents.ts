import type { FileNode } from "~/server/types/file-node";

export function filterFileTree(nodes: Array<FileNode>, query: string): Array<FileNode> {
  const needle = query.trim().toLowerCase();
  if (!needle) {return nodes;}

  const filtered: Array<FileNode> = [];

  for (const node of nodes) {
    const children = node.children ? filterFileTree(node.children, needle) : [];
    const selfMatch =
      node.name.toLowerCase().includes(needle) ||
      node.fullPath.toLowerCase().includes(needle);

    if (!selfMatch && children.length === 0) {continue;}

    if (node.isFolder) {
      filtered.push({
        ...node,
        children: selfMatch ? (node.children ?? []) : children,
      });
      continue;
    }

    if (selfMatch) {filtered.push(node);}
  }

  return filtered;
}

export function flattenSearchHits(nodes: Array<FileNode>, query: string): Array<FileNode> {
  const needle = query.trim().toLowerCase();
  if (!needle) {return nodes;}

  const hits: Array<FileNode> = [];

  const walk = (list: Array<FileNode>) => {
    for (const node of list) {
      const matches =
        node.name.toLowerCase().includes(needle) ||
        node.fullPath.toLowerCase().includes(needle);

      if (matches) {hits.push(node);}
      if (node.children?.length) {walk(node.children);}
    }
  };

  walk(nodes);
  return hits;
}
