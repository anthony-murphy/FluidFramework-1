/* eslint-disable @typescript-eslint/no-non-null-assertion */
/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

export interface ListNode<T> {
    readonly list: List<T> | undefined;
    readonly data: T;
    readonly next: ListNode<T> | undefined;
    readonly prev: ListNode<T> | undefined;
}

class HeadNode<T> {
    public _next: HeadNode<T> | DataNode<T> = this;
    public _prev: HeadNode<T> | DataNode<T> = this;
    public headNode: HeadNode<T>;
    private readonly _list?: List<T>;
    constructor(list?: List<T> | undefined) {
        this.headNode = this;
        if (list) {
            this._list = list;
        }
    }
    public get next(): DataNode<T> | undefined {
        return this._next === this.headNode
            ? undefined
            : this._next as DataNode<T>;
    }
    public get prev(): DataNode<T> | undefined {
        return this._prev === this.headNode
            ? undefined
            : this._prev as DataNode<T>;
    }
    public get list() {
        return this.headNode._list;
    }
}

const DeadHead = new HeadNode<any>(undefined);

class DataNode<T> extends HeadNode<T> implements ListNode<T> {
    constructor(headNode: HeadNode<T>, public readonly data: T) {
        super(undefined);
        this.headNode = headNode;
    }
}

function append<T>(precedingNode: DataNode<T> | HeadNode<T>, ... items: T[]) {
    let pNode = precedingNode;
    const oldNext = pNode._next;
    items.forEach((n) => {
        pNode._next = new DataNode<T>(pNode.headNode, n);
        pNode._next._prev = pNode;
        pNode = pNode._next;
    });
    oldNext._prev = pNode;
    pNode._next = oldNext;
    return oldNext;
}

export function walk<T>(from: ListNode<T>, forward: boolean, handler: (node: ListNode<T>) => boolean | undefined) {
    let node: ListNode<T> | undefined = from;
    while (node !== undefined) {
        if (handler(node) === false) {
            return false;
        }
        node = forward ? node.next : node.prev;
    }
    return true;
}

export class List<T> implements Iterable<ListNode<T>> {
    pop(): ListNode<T> | undefined {
        return this.remove(this.prev);
    }
    push(...items: T[]): { first: ListNode<T>; last: ListNode<T>; } {
        this._len += items.length;
        const pStart = append(this.headNode._prev, ... items);
        return { first: pStart.next!, last: this.headNode.prev! };
    }

    shift(): ListNode<T> | undefined {
        return this.remove(this.next);
    }

    unshift(...items: T[]): { first: ListNode<T>; last: ListNode<T>; } {
        this._len += items.length;
        const pEnd = append(this.headNode, ... items);
        return { first: this.headNode.next!, last: pEnd.prev! };
    }

    public has(node: ListNode<T> | undefined): boolean {
        return this._has(node);
    }

    private _has(node: ListNode<T> | undefined): node is DataNode<T> {
        return node instanceof DataNode && node.headNode === this.headNode;
    }

    remove(node: ListNode<T> | undefined): ListNode<T> | undefined {
        if (this._has(node)) {
            if (node._next !== node._prev) {
                node._prev._next = node._next;
                node._next._prev = node._prev;
                node._next = node._prev = node;
                node.headNode = DeadHead;
                this._len--;
                return node;
            }
        }
        return undefined;
    }

    public [Symbol.iterator](): IterableIterator<ListNode<T>> {
        let value = this.next;
        const iterator: IterableIterator<ListNode<T>> = {
            next(): IteratorResult<ListNode<T>> {
                if (value !== undefined) {
                    const rtn = { value, done: false };
                    value = value.next;
                    return rtn;
                }
                return { value: undefined, done: true };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
        return iterator;
    }

    private _len: number = 0;
    private readonly headNode: HeadNode<T> | DataNode<T> = new HeadNode(this);
    public get length() { return this._len; }
    public get empty() { return this.headNode._next === this.headNode; }
    public get next(): ListNode<T> | undefined {
        return this.headNode.next;
    }

    public get prev(): ListNode<T> | undefined {
        return this.headNode.prev;
    }
}

export function WalkList<T>(
    list: List<T>,
    visitor: (lref: ListNode<T>) => boolean | void | undefined,
    start?: ListNode<T>,
    forward: boolean = true,
) {
    let current = start ?? (forward ? list.next : list.prev);
    while (current !== undefined) {
        if (visitor(current) === false) {
            return false;
        }
        current = forward ? current.next : current.prev;
    }
    return true;
}
