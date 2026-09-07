"""Bounded, memory-only source references; a miss never adopts newer disk bytes."""
from collections import OrderedDict
from threading import RLock


class SourceSnapshots:
    def __init__(self, budget=32 * 1024 * 1024, max_entries=4096):
        self.budget = budget
        self.max_entries = max_entries
        self.size = 0
        self.sources = OrderedDict()
        self.lock = RLock()

    def remember(self, documents):
        with self.lock:
            for path, doc in documents.items():
                key = (path, doc["revision"])
                if key in self.sources:
                    self.sources.move_to_end(key)
                    continue
                source = doc["source"]
                size = len(source.encode("utf-8"))
                if size > self.budget:
                    continue
                self.sources[key] = (source, size)
                self.size += size
                while self.size > self.budget or len(self.sources) > self.max_entries:
                    _, (_, removed) = self.sources.popitem(last=False)
                    self.size -= removed

    def resolve(self, refs):
        if not isinstance(refs, dict) or any(not isinstance(v, str) for v in refs.values()):
            raise ValueError("preview baseRefs must map paths to captured revisions")
        with self.lock:
            result = {}
            for path, revision in refs.items():
                key = (path, revision)
                if key not in self.sources:
                    raise ValueError("Captured source expired or server restarted. Your edits are kept; "
                                     "copy them before reloading. Missing snapshot: " + path)
                result[path] = self.sources[key][0]
                self.sources.move_to_end(key)
            return result
