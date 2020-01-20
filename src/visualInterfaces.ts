import powerbi from 'powerbi-visuals-api';
import PrimitiveValue = powerbi.PrimitiveValue;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import DataViewObjects = powerbi.DataViewObjects;
import * as d3 from 'd3';
import { valueFormatter } from 'powerbi-visuals-utils-formattingutils';
import IValueFormatter = valueFormatter.IValueFormatter;
import { interactivitySelectionService } from 'powerbi-visuals-utils-interactivityutils';
import SelectableDataPoint = interactivitySelectionService.SelectableDataPoint;
import { legendInterfaces } from 'powerbi-visuals-utils-chartutils';
import LegendDataPoint = legendInterfaces.LegendDataPoint;
import { shapesInterfaces } from 'powerbi-visuals-utils-svgutils';
import BoundingRect = shapesInterfaces.BoundingRect;
import { VisualSettings } from './settings';

export type Selection<T> = d3.Selection<any, T, any, any>;
export type D3Scale = d3.ScaleBand<any> | d3.ScaleLinear<any, any> | d3.ScaleOrdinal<any, any> | d3.ScaleTime<any, any>;

export interface VisualViewModel {
    rows: PrimitiveValue[];
    columns: PrimitiveValue[];
    rowsFormat: string;
    columnsFormat: string;
    categories: PrimitiveValue[];
    legendDataPoint: LegendDataPointExtended[];
    dataPoints: VisualDataPoint[];
    lines: LineDataPoint[];
    lineKeyIndex: LineKeyIndex;
    domain: VisualDomain;
    valueFormat: string;
    categoryIsDate: boolean;
    categoryFormat: string;
    categoryIsScalar: boolean;
    categoryName: string;
    valuesName: string;
    legendFormatter: IValueFormatter;
    legendType: CategoryType;
    settings: VisualSettings;
}
export interface LegendDataExtended {
    title: string;
    dataPoints: LegendDataPointExtended[];
}
export enum CategoryType {
    Error = 0,
    String = 1,
    Number = 2,
    Boolean = 3,
    Date = 4
}
export interface LegendDataPointExtended extends LegendDataPoint {
    markerColor: string;
    showMarkers?: boolean;
    markerShape?: legendInterfaces.MarkerShape;
    object: DataViewObjects;
    icon: any;
}
export interface LineKeyIndex {
    [lineKey: string]: number;
}
export interface LegendBehaviorOptions {
    legendItems: Selection<any>;
    legendIcons: Selection<any>;
    clearCatcher: Selection<any>;
}
export interface LassoData {
    lassoData: BoundingRect;
    startX: number;
    startY: number;
    selectedLegendNames: string[];
}
export interface LinePoint {
    y: number;
    value: string;
    name: string;
    color: string;
    showMarkers: boolean;
    lineKey: string;
}
export class XAxisData {
    x: D3Scale;
    xAxisDataPoints: any[];
    lines: LineDataPoint[];
    start: number;
    end: number;
}
export class VerticalLineDataItem {
    x: number;
    tooltips: VisualTooltipDataItem[];
    linePoints: LinePoint[];
    rectGlobalX: number;
    rectGlobalY: number;
}
export class VerticalLineDataItemsGlobalWithKey {
    [lineKey: string]: VerticalLineDataItemsGlobal;
}
export class VerticalLineDataItemsGlobal {
    verticalLineDataItems: VerticalLineDataItem[];
    hoverLineData: Selection<number>;
}
export enum LabelsAction {
    Simple = 1,
    Rotate35 = 2,
    Rotate90 = 3
}

export interface SimplePoint {
    x: PrimitiveValue;
    y: number;
    tooltips?: VisualTooltipDataItem[];
    lineKey?: string;
}

export interface VisualDataPoint extends SimplePoint, SelectableDataPoint {
}

export interface Coordinates {
    x: number;
    y: number;
    value: string;
    bgX: number;
    bgY: number;
    bgWidth: number;
    bgHeight: number;
}

export interface LineDataPoint extends SelectableDataPoint {
    lineKey: string;
    name: string;
    points: SimplePoint[];
    color: string;
    strokeWidth?: number;
    strokeLineJoin?: string;
    lineStyle?: string;
    stepped?: boolean;

    showMarkers?: boolean;
    markerShape?: string;
    markerSize?: number;
    markerColor?: string;
}

export class LineDataPointForLasso {
    lineKey: string;
    points: SimplePoint[];
}

export interface VisualDomain {
    start?: number;
    end?: number;
    startForced: boolean;
    endForced: boolean;
}