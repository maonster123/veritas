"use client";

import { useReducer, useCallback } from "react";
import type { FlatNode } from "@/lib/outline-utils";
import { buildTree } from "@/lib/outline-utils";
import {
  getOutlineTree,
  addNode,
  updateNode,
  deleteNode,
  moveNode,
} from "@/app/actions/outline";

interface State {
  tree: FlatNode[];
  loading: boolean;
  selectedId: string | null;
}

type Action =
  | { type: "SET_TREE"; tree: FlatNode[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SELECT"; id: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TREE":
      return { ...state, tree: action.tree, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SELECT":
      return { ...state, selectedId: action.id };
    default:
      return state;
  }
}

export function useOutlineTree(projectId: string) {
  const [state, dispatch] = useReducer(reducer, {
    tree: [],
    loading: true,
    selectedId: null,
  });

  const loadTree = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    const nodes = await getOutlineTree(projectId);
    dispatch({ type: "SET_TREE", tree: buildTree(nodes as any) });
  }, [projectId]);

  const select = useCallback((id: string | null) => {
    dispatch({ type: "SELECT", id });
  }, []);

  const handleAdd = useCallback(
    async (parentId: string | null, title: string, type: string) => {
      await addNode(projectId, parentId, title, type as any, 0);
      await loadTree();
    },
    [projectId, loadTree]
  );

  const handleUpdate = useCallback(
    async (nodeId: string, data: { title?: string; content?: string; notes?: string }) => {
      await updateNode(nodeId, data);
      await loadTree();
    },
    [loadTree]
  );

  const handleDelete = useCallback(
    async (nodeId: string) => {
      await deleteNode(nodeId);
      dispatch({ type: "SELECT", id: null });
      await loadTree();
    },
    [loadTree]
  );

  const handleMove = useCallback(
    async (nodeId: string, newParentId: string | null, newSortOrder: number) => {
      await moveNode(nodeId, newParentId, newSortOrder);
      await loadTree();
    },
    [loadTree]
  );

  return { state, dispatch, loadTree, select, handleAdd, handleUpdate, handleDelete, handleMove };
}
