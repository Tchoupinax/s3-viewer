import type { FileNode } from "~/server/types/file-node";

export function flattenVisibleTree(
  nodes: FileNode[],
  collapsedPaths: Set<string>,
): FileNode[] {
  const result: FileNode[] = [];

  function walk(list: FileNode[]) {
    for (const node of list) {
      result.push(node);
      if (
        node.isFolder
        && !collapsedPaths.has(node.fullPath)
        && node.children?.length
      ) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return result;
}

export function findNodeByPath(
  nodes: FileNode[],
  fullPath: string,
): FileNode | null {
  for (const node of nodes) {
    if (node.fullPath === fullPath) {return node;}
    if (node.children?.length) {
      const found = findNodeByPath(node.children, fullPath);
      if (found) {return found;}
    }
  }
  return null;
}

export function isPathInsideFolder(path: string, folderPath: string): boolean {
  const prefix = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
  return path.startsWith(prefix);
}

export function dedupeNestedSelection(nodes: FileNode[]): FileNode[] {
  return nodes.filter(
    node =>
      !nodes.some(
        other =>
          other !== node
          && other.isFolder
          && isPathInsideFolder(node.fullPath, other.fullPath),
      ),
  );
}

export function selectRangeInList(
  items: FileNode[],
  anchorPath: string,
  targetPath: string,
  currentSelection: Set<string>,
  replace: boolean,
): Set<string> {
  const anchorIdx = items.findIndex(node => node.fullPath === anchorPath);
  const targetIdx = items.findIndex(node => node.fullPath === targetPath);
  if (anchorIdx === -1 || targetIdx === -1) {return currentSelection;}

  const start = Math.min(anchorIdx, targetIdx);
  const end = Math.max(anchorIdx, targetIdx);
  const next = replace ? new Set<string>() : new Set(currentSelection);

  for (let i = start; i <= end; i++) {
    next.add(items[i]!.fullPath);
  }

  return next;
}

export function nodesFromPaths(
  nodes: FileNode[],
  paths: Set<string>,
): FileNode[] {
  const result: FileNode[] = [];

  function walk(list: FileNode[]) {
    for (const node of list) {
      if (paths.has(node.fullPath)) {result.push(node);}
      if (node.children?.length) {walk(node.children);}
    }
  }

  walk(nodes);
  return result;
}

export function pruneSelectionPaths(
  nodes: FileNode[],
  selectedPaths: Set<string>,
): Set<string> {
  const valid = new Set<string>();

  function walk(list: FileNode[]) {
    for (const node of list) {
      if (selectedPaths.has(node.fullPath)) {valid.add(node.fullPath);}
      if (node.children?.length) {walk(node.children);}
    }
  }

  walk(nodes);
  return valid;
}
