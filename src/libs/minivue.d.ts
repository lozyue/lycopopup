declare module "minivue/utils/utils" {
    export const DEBUG = true;
    export type AnyFunction<T extends any[] = any[], R = any> = (...args: T) => R;
    export const enum AGREEDKEYS {
        VALUEKEY = "value",
        INTERNALTYPEKEY = "_rtype",
        MountEleRefAttr = "ref",
        MountEleSkipAttr = "$skip"
    }
    export const NullFn: (this: any, ...p: any[]) => any;
    export const waitMicro: (cb: () => void, singleParam?: any) => Promise<void>;
    export const setImmediate: (cb: () => void, singleParam?: any) => number;
    export var pierceGet: (source: object, objPath: (string | number)[]) => any;
    export const removeArrItem: <T>(arr: T[], item: T) => boolean;
    export const clearArr: <T>(arr: Array<T>) => T[];
    interface ChildTreeNode {
        children: null | ChildTreeNode[];
    }
    export const DFS_Iterate: <T extends ChildTreeNode>(node: T, action: (node: T) => void | boolean, fromTail?: boolean) => void;
    export const HTML_Iterate: (eleList: HTMLCollection | Element[], action: (node: Element, depth: number) => 0 | 1 | -1, depth?: number) => boolean;
    export const is_PlainObject: (obj: any) => boolean;
    export const is_Object: (obj: unknown) => obj is object;
    export const is_Function: <T extends Function>(obj: unknown) => obj is T;
    export const is_Array: (obj: unknown) => obj is Array<unknown>;
    export const is_Defined: <T>(obj: T) => obj is NonNullable<T>;
    export const NullArr: any[];
}
declare module "minivue/utils/light-set" {
    export class LightSet<T> {
        size: number;
        _eq: (a: T, b: T) => boolean;
        private ctt;
        constructor(equalFn?: LightSet<T>["_eq"]);
        index(item: T): number;
        item(index: number): T;
        set(index: number, item: T): void;
        add(item: T): number;
        $add(item: T): number;
        delete(item: T): number;
        clear(): void;
        values(): T[];
        forEach(cb: (item: T, idx: number, arr: T[]) => void): void;
    }
    export class LightMap<T, U> {
        private keys;
        private vals;
        constructor(equalFn?: LightSet<T>["_eq"]);
        get(key: T): U | undefined;
        set(key: T, val: U): number;
        delete(key: T): number;
        clear(): void;
    }
    export class TiedBilist<T extends {}, U extends {}> {
        k: T[];
        v: U[];
        constructor(keys?: T[], vals?: U[]);
        add(key: T, item: U): number;
        set(key: T, item: U, index: number): void;
        del(index: number): [T, U];
        delete(key: T): number;
        get(key: T): U | undefined;
        _get(index: number): undefined | U;
        index(key: T): number;
        replace(key: T, item: U, index?: number): [T, U];
        _swap(srcIdx: number, destIdx: number): void;
        move(src: T, dest?: T): void;
        _move(srcIdx: number, destIdx?: number): void;
    }
}
declare module "minivue/reactive/scope" {
    import { AnyFunction } from "minivue/utils/utils";
    import { LightMap, LightSet } from "minivue/utils/light-set";
    interface THREADCONTEX {
        dep: Dep | null;
        scope: Scope | null;
    }
    export const TdCTX: THREADCONTEX;
    export function scope(scp?: null | Scope): Scope;
    export const getScope: () => Scope | null;
    export const getContext: () => THREADCONTEX;
    export const nextTick: (cb: () => any) => void;
    type DepStruct = {
        map?: LightMap<string | symbol, Array<EffectCallback>>;
        list: Array<EffectCallback>;
    };
    export class Dep {
        store: WeakMap<WeakKey, DepStruct>;
        updated: -1 | 0 | 1;
        tickTasks: LightSet<EffectCallback>;
        schedule: {
            0: LightSet<EffectCallback[]>;
            1: Array<ValChange>;
            2: LightSet<OvertopEffectCallback[]>;
            3: Array<LightSet<OvertopValChange>>;
        };
        _couch: {
            eff: LightSet<EffectCallback[] | OvertopEffectCallback[]>;
            src: Array<MutexUnit>;
        };
        stopped: boolean;
        kicking: boolean;
        srcing: boolean;
        onTick: Array<(...p: any[]) => any>;
        throttle: (cb: () => void, p?: any) => any;
        constructor(throttle: Dep["throttle"]);
        track(target: WeakKey, isRef: boolean, prop: string | symbol, holistic?: boolean): boolean;
        peek(target: WeakKey): DepStruct | null;
        trigger(effectDep: DepStruct, isRef: boolean, prop: string | symbol, val: ValChange): boolean;
        kickFrame(srcing?: boolean): void;
        treadFrame(effect: EffectCallback | OvertopEffectCallback): () => void;
        run(): void;
        stop(): void;
        destroy(): void;
    }
    class Scope {
        dep: Dep;
        private skips;
        run(runner: () => any, away?: boolean): void;
        should(fn: AnyFunction): boolean;
        silent(frame: Function): void;
        avoid(bilateral_effect: AnyFunction): void;
        stop(): void;
        destroy(): void;
    }
    interface MutexUnit {
        0: WeakKey;
        1: string | symbol;
        2: DepStruct;
    }
    export interface ValChange<T = unknown> {
        old: T;
        now: T;
    }
    export interface OvertopValChange<T = unknown> {
        0: string | symbol;
        1: ValChange<T>;
    }
    export type EffectCallback = (p: ValChange[]) => any;
    export type OvertopEffectCallback = (p: OvertopValChange[]) => any;
}
declare module "minivue/reactive/convert" {
    import { type EffectCallback } from "minivue/reactive/scope";
    import { AGREEDKEYS } from "minivue/utils/utils";
    import type { OvertopValChange, ValChange } from "minivue/reactive/scope";
    export function isRef<T>(proxyReactive: Ref<T> | unknown): proxyReactive is Ref<T>;
    export function isReactive(proxyReactive: any): proxyReactive is Reactive<object>;
    export function isComputed(proxyReactive: any): proxyReactive is Computed<object>;
    export interface Ref<T> {
        [AGREEDKEYS.VALUEKEY]: T;
    }
    interface RefOption {
        readonly: boolean;
        retype: boolean;
    }
    export function ref<T>(rawValue: T, option?: Partial<RefOption>): Ref<T>;
    interface ReactiveOption {
    }
    export type Reactive<T extends object = {}> = T & {};
    export function reactive<T extends object>(rawObject: T, options?: Partial<ReactiveOption>): T;
    export function watchEffect(targetFn: EffectCallback): () => void;
    interface WatchOption {
        lazy: boolean;
    }
    type WatchCallbackValChange<T> = T & {
        mutate: boolean;
    };
    type WatchCallback<T = ValChange> = (vals: Array<WatchCallbackValChange<T>>) => any;
    export function watch(pxyValueOrFn: Ref<any> | (() => any), cbFn: WatchCallback<ValChange>, option?: Partial<WatchOption>): () => void;
    export function watch<T extends object>(pxyValueOrFn: Reactive<T>, cbFn: WatchCallback<OvertopValChange>, option?: Partial<WatchOption>): () => void;
    export interface Computed<T> {
        [AGREEDKEYS.VALUEKEY]: T;
        destroy: () => void;
    }
    export function computed<T>(computeFn: () => T): Computed<T>;
}
declare module "minivue/utils/helper" {
    type ValueUpperObtain = [
        any,
        object,
        string
    ];
    export function obtainValWithOptionalUpper(scopeObj: any, ctx: any, attrExp: string, noUpper?: boolean): ValueUpperObtain;
    export const expressionSyntaxEval: <T extends {} = any>(scope: T, exp: string) => readonly [any, (string | number)[]];
    export function swapInSibling(ele1: Node, ele2: Node): void;
    export function parseHTML(htmlString: {
        html: string;
    }): readonly [DocumentFragment, Element[]];
    export const enum MountMode {
        Append = 0,
        Override = -1,
        InsertBefore = -2,
        InsertAfter = 1
    }
    export function mountChildren(ele: HTMLElement | ShadowRoot, fragments: DocumentFragment, mode?: MountMode): () => void;
    export interface RtCreateStyle<L extends boolean> {
        cl: () => void;
        adopt: (localRoot?: L extends false ? Element : Element | ShadowRoot) => void;
        el?: HTMLStyleElement;
    }
    export function createStyle<T extends string = "val", L extends boolean = true>(styleVal: Record<T, string>, key?: T, legacy?: L): RtCreateStyle<L>;
    export class CycleArray<T> {
        ctt: Array<T>;
        private readonly size;
        b: number;
        len: number;
        onDrop?: (item: T) => void;
        constructor(size: number, fill?: T);
        add(item: T): number;
        free(): T | null;
        clear(): void;
        full(): boolean;
        item(index: number): T;
        values(): Generator<NonNullable<T>, void, unknown>;
    }
}
declare module "minivue/domer/list-render" {
    import { OvertopValChange, ValChange } from "minivue/reactive/scope";
    type ExpressionParseResult_for = [
        string,
        boolean,
        string,
        undefined | string,
        undefined | string
    ];
    export const parserExpression_FOR: (expression: string) => ExpressionParseResult_for;
    export const enum SlotChangeType {
        Truncate = 0,
        Assign = 1,
        Padding = 2
    }
    type SlotChangeItem = ValChange<unknown> & {
        id: number;
        CD: SlotChangeType;
    };
    export const calcArrChange: (changes: OvertopValChange<number>[], calcMove?: boolean) => readonly [SlotChangeItem[], (ValChange<number> & {
        prop: string;
    })[]];
    export interface ListRenderBaseOpt<T extends Element, U = unknown> {
        create: (data: U) => T;
        onRemove: (ele: T) => void;
    }
    export abstract class ListRenderBase<T extends Element = HTMLElement, U = unknown> {
        root: T;
        _create: ListRenderBaseOpt<T, U>["create"];
        _onRemove: ListRenderBaseOpt<T, U>["onRemove"];
        constructor(container: T, opt: ListRenderBaseOpt<T, U>);
        create(data: U, position?: number): T;
        protected abstract _c(data: U): T;
        protected abstract alloc(data: U): T;
        protected _insert(ele: T, position: number): void;
        protected _remove(el: T): void;
        locate(child: T): number;
    }
}
declare module "minivue/domer/attribute" {
    export const FormElements: string[];
    export const InternalFormValue: string[];
    const enum BindingType {
        UNRECOGNIZE = -1,
        ATTR = 0,
        EVENTS = 1,
        FORMVALUE = 2,
        SPECIALATTR = 3,
        HIDE = 4,
        SCOPE = 5,
        REF = 6,
        SKIP = 7,
        FORIN = 8,
        CUSTOM = 9
    }
    export type AttrBucket = [
        string,
        string,
        BindingType,
        string[],
        string,
        undefined | string
    ];
    type AttrExtractResult = [
        AttrBucket[],
        undefined | number,
        undefined | number,
        undefined | number,
        undefined | number
    ];
    export function extractAttr(ele: Element, remove$?: boolean): AttrExtractResult;
    export function applyAttrBinding(ele: HTMLElement, data: Record<string, unknown>, ctx: any, attrBucket: AttrBucket[], useEffect?: boolean, TWBinding?: boolean, removeBindMark?: boolean): () => void;
    export function activateAttr(ele: HTMLElement, data: Record<string, unknown>, ctx: Record<string, unknown>, useEffect?: boolean, TWBinding?: boolean): () => void;
    export function objectAttrBinding(targetVal: any, ele: HTMLElement, isStyleBinding: boolean): void;
}
declare module "minivue/domer/render" {
    import { Reactive } from "minivue/reactive/convert";
    import { CycleArray } from "minivue/utils/helper";
    import { AnyFunction } from "minivue/utils/utils";
    import { ListRenderBase, ListRenderBaseOpt } from "minivue/domer/list-render";
    import { TiedBilist } from "minivue/utils/light-set";
    type EventKeys = keyof HTMLElementEventMap;
    type EveOption = {
        bind: boolean;
        propSrc: Reactive<object>;
        efStops: AnyFunction[];
    } & {
        [K in EventKeys]: AddEventListenerOptions;
    };
    type EveHandle<EK extends EventKeys = EventKeys> = {
        5: string;
        6: (this: HTMLElement, ev: HTMLElementEventMap[EK]) => any;
        7: Element;
    };
    export function h<T extends keyof HTMLElementTagNameMap>(tag: T, attrs?: Record<string, any> | (() => Record<string, any>), children?: Array<undefined | HTMLElement | DocumentFragment | string | (() => HTMLElement)>, events?: Partial<{
        [EK in EventKeys]: EveHandle<EK>[6];
    }>, hOpt?: Partial<EveOption>): HTMLElementTagNameMap[T];
    type hCtxReset = (effect: boolean, eve: boolean, attr: boolean) => void;
    type hCtxPatchFn = (patch_data: hPatchData, cIdxes?: number[]) => void;
    export function hCtx(cb: AnyFunction, struct_cap?: false): {
        reset: hCtxReset;
        patch: null;
        run: (cb: AnyFunction) => void;
    };
    export function hCtx(cb: AnyFunction, struct_cap: true): {
        reset: hCtxReset;
        patch: hCtxPatchFn;
        run: (cb: AnyFunction) => void;
    };
    type hParameter = Parameters<typeof h>;
    type hPatchData = [hParameter[1], hPatchDataChildren?, hParameter[3]?, hParameter[4]?];
    type hPatchDataChildren = Array<string | undefined | ([NonNullable<hParameter[1]>, hPatchDataChildren?, hParameter[3]?, hParameter[4]?])>;
    type PatchFunc = ReturnType<typeof hCtx>["patch"];
    interface ListRenderOpt<T extends Element, U = unknown> extends ListRenderBaseOpt<T, U> {
        driftSize?: number;
        reuse?: (ele: T, data: U, reset: hCtxReset, patch: null | PatchFunc) => null | T;
        update: (ele: T, data: U, reset: hCtxReset, patch: null | PatchFunc, alloc: () => T) => T;
        capture?: boolean;
    }
    export class ListRender<T extends Element = HTMLElement, U = unknown> extends ListRenderBase<T, U> {
        driftNs: CycleArray<T>;
        readonly capture: boolean;
        _reuse: ListRenderOpt<T, U>["reuse"];
        _update: ListRenderOpt<T, U>["update"];
        private ctxMap;
        constructor(container: T, opt: ListRenderOpt<T, U>);
        private __reuse;
        protected alloc(data: U): T;
        protected _c(data: U): T;
        update(el: T, data: U): void;
        insert(ele: T, position: number): void;
        remove(el: T): void;
        replaceBatch(toRemove: T[], datas: U[], position?: number): T[];
        private drift;
        static swap(nodeA: Node, nodeB: Node): void;
    }
    interface ListRenderFullOpt<T extends Element, U> extends ListRenderOpt<T, U> {
    }
    export class ListRenderFull<T extends Element, U extends WeakKey> {
        elMap: TiedBilist<U, T>;
        lr: ListRender<T, U>;
        constructor(container: T, opt: ListRenderFullOpt<T, U>);
        getEle(data: U): T | undefined;
        create(data: U, position?: number): T;
        remove(data: U): boolean;
        update(oldData: U, newData: U): boolean;
        replaceBatch(oldDatas: U[], newDatas: U[]): void;
        move(data: U, position: number): boolean;
        swap(data1: U, data2: U): boolean;
    }
}
declare module "minivue/domer/mini-app" {
    import { MountMode } from "minivue/utils/helper";
    export type MiniApp<L extends boolean = true, U extends Record<string, unknown> = Record<string, unknown>> = {
        refs: Record<string, HTMLElement>;
        refx: Record<string, HTMLElement[]>;
        els: HTMLElement[];
        data: U;
        mount: (ele: L extends false ? HTMLElement : HTMLElement | ShadowRoot, mode?: MountMode) => (() => void) | null;
        onmounted: (fn: any) => void;
        destroy: () => void;
    };
    export function createApp<L extends boolean = false>(template: {
        style: string;
        html: string;
    }, data: Record<string, unknown>, styleLegacy?: L, localStyle?: boolean): MiniApp<L, Record<string, unknown>>;
    export function scopeApp(creator: (setRoot: <L extends boolean = true>(sr: L extends false ? ShadowRoot : HTMLElement | ShadowRoot) => void) => void): {
        unmount: () => void;
        destory: () => void;
    };
}
declare module "minivue/domer/plugin" {
    interface MinivuePlugin extends Partial<MinivuePluginDefine> {
        priority: number;
    }
    export interface MinivuePluginDefine {
        traverse: (ele: HTMLElement, cmpntCtx: Record<string, unknown>) => 0 | -1 | 1;
        ctx: Record<string, unknown>;
        priority: number;
    }
    export function usePlugin(define: Partial<MinivuePluginDefine>): void;
    export function getPluginList(): MinivuePlugin[] | null;
    export function buildPluginCtx(): {};
    export function callPlugin(ele: HTMLElement, cmpntCtx: Record<string, unknown>): 0 | -1 | 1;
}
declare module "minivue/domer/mounter" {
    interface AppSetup {
        refs: Record<string, HTMLElement>;
        refx: Record<string, HTMLElement[]>;
        destroy: () => void;
    }
    export function setupApp(container: Element | HTMLCollection | Element[], data: Record<string, unknown>, filter?: (ele: Element, depth: number, abort: (condition?: boolean) => boolean) => boolean): AppSetup;
}
declare module "minivue" {
    export * from "minivue/reactive/convert";
    export { scope, getScope, nextTick, type ValChange, type OvertopValChange, type EffectCallback, type OvertopEffectCallback, } from "minivue/reactive/scope";
    export { activateAttr } from "minivue/domer/attribute";
    export { setupApp } from "minivue/domer/mounter";
    export { createApp, scopeApp } from "minivue/domer/mini-app";
    export type { MiniApp } from "minivue/domer/mini-app";
    export * from "minivue/domer/render";
    export { calcArrChange } from "minivue/domer/list-render";
    export { createStyle as c, MountMode, } from "minivue/utils/helper";
    export { usePlugin, MinivuePluginDefine } from "minivue/domer/plugin";
}
