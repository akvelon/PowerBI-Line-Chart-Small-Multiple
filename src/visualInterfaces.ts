module powerbi.extensibility.visual {
    import Selection = d3.Selection;
    import IValueFormatter = utils.formatting.IValueFormatter;
    import SelectableDataPoint = utils.interactivity.SelectableDataPoint;
    import LegendDataPoint = utils.chart.legend.LegendDataPoint;
    import BoundingRect = utils.svg.shapes.BoundingRect;

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
        Date= 4
    }
    export interface  LegendDataPointExtended extends LegendDataPoint {
        markerColor: string;
        showMarkers?: boolean;
        markerShape?: string;
        object: DataViewObjects;
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
    }
    export class XAxisData {
        x: any;
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
        hoverLineData: d3.selection.Update<number>;
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

    export interface LineDataPoint extends SelectableDataPoint
    {
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
}