"""Operational station-prefix and network-connectivity structures."""

class Trie:
    def __init__(self):
        self.root = {}

    def insert(self, word):
        node = self.root
        for letter in word:
            node = node.setdefault(letter, {})
        node["$"] = True

    def search(self, word):
        node = self.root
        for letter in word:
            if letter not in node:
                return False
            node = node[letter]
        return "$" in node

    def delete(self, word):
        def remove(node, index):
            if index == len(word):
                node.pop("$", None)
            elif word[index] in node:
                if remove(node[word[index]], index + 1):
                    del node[word[index]]
            return not node

        remove(self.root, 0)

    def autocomplete(self, prefix):
        node = self.root
        for letter in prefix:
            if letter not in node:
                return []
            node = node[letter]
        words = []

        def collect(branch, text):
            if "$" in branch:
                words.append(text)
            for letter in sorted(k for k in branch if k != "$"):
                collect(branch[letter], text + letter)

        collect(node, prefix)
        return words

    def picture(self):
        nodes, edges = [], []

        def visit(branch, path="", depth=0):
            nodes.append(
                {
                    "id": path,
                    "label": (path[-1:] or "root") + ("•" if "$" in branch else ""),
                    "depth": depth,
                }
            )
            for letter in sorted(k for k in branch if k != "$"):
                edges.append([path, path + letter])
                visit(branch[letter], path + letter, depth + 1)

        visit(self.root)
        levels = {}
        for node in nodes:
            levels.setdefault(node["depth"], []).append(node)
        for depth, level in levels.items():
            for index, node in enumerate(level):
                node.update(x=(index + 1) * 100 / (len(level) + 1), y=depth * 45 + 25)
        return {"nodes": nodes, "edges": edges}


class DisjointSet:
    def __init__(self, values):
        self.parent = {v: v for v in values}
        self.rank = {v: 0 for v in values}

    def find(self, value):
        if self.parent[value] != value:
            self.parent[value] = self.find(self.parent[value])
        return self.parent[value]

    def union(self, a, b):
        a, b = self.find(a), self.find(b)
        if a == b:
            return False
        if self.rank[a] < self.rank[b]:
            a, b = b, a
        self.parent[b] = a
        if self.rank[a] == self.rank[b]:
            self.rank[a] += 1
        return True


