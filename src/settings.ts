"use strict";

import {DataViewObjectsParser} from "powerbi-visuals-utils-dataviewutils/lib/dataViewObjectsParser";
import {MarkerShape} from "powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces";

export const DefaultFontFamily: string = "\"Segoe UI\", wf_segoe-ui_normal, helvetica, arial, sans-serif";
const DataLabelsFontFamily: string = "wf_standard-font, helvetica, arial, sans-serif";
export const DefaultSeparator: string = "_";
export const DefaultOpacity: number = 1;
export const DimmedOpacity: number = 0.4;
export const DefaultTooltipCircleRadius: number = 3;
export const DataLabelEps: number = 2;
export const DataLabelR: number = 4;
export const MinStrokeWidth = 1;
export const PrecisionMinValue = 0;
export const MaximumSizeStartValue = 15;
export const MaximumSizeEndValue = 50;
export const MinCategoryWidthStartValue: number = 20;
export const MinCategoryWidthEndValue: number = 180;
export const NiceDateFormat: string = "M/d/yyyy";

export class VisualSettings extends DataViewObjectsParser {
    public smallMultiple = new SmallMultiple();
    public general = new GeneralSettings();
    public legend = new LegendSettings();
    public xAxis = new XAxisSettings();
    public yAxis = new YAxisSettings();
    public dataPoint = new DataPointSettings();
    public dataLabels = new DataLabelsSettings();
    public shapes = new Shapes();
    public selectionColor = new SelectionColor();
}

export class SmallMultiple {
    public enable: boolean = true;
    public layoutMode: string = "Flow";
    public minUnitWidth: number = 150;
    public minUnitHeigth: number = 120;
    public minRowWidth: number = 4;
    public showEmptySmallMultiples: boolean = true;
    public showChartTitle: boolean = true;
    public smColor: string = "#666";
    public fontSize: number = 14;
    public fontFamily: string = DefaultFontFamily;
    public showSeparators: boolean = true;
}

export class GeneralSettings {
    // Responsive
    public responsive: boolean = true;
}

export class LegendSettings {
    // Show legend
    public show: boolean = true;
    // Position
    public position: string = "Top";
    // Show title
    public showTitle: boolean = true;
    // Legend Name
    public legendName: string = null;
    // Legend Name Fill
    public legendNameColor: string = "#666";
    // Legend Font Family
    public fontFamily: string = DefaultFontFamily;
    // Legend Font Size
    public fontSize: number = 8;
    //Legend style
    public style: string = "markers";
    // Match line color
    public matchLineColor: boolean = true;
    // Circle default icon
    public circleDefaultIcon: boolean = true;
}

export class XAxisSettings {
    // Show category axis
    public show: boolean = true;
    // Axis type
    public axisType: string = "continuous";
    // Axis Scale type
    public axisScale: string = "linear";
    // Chart Range Type
    public chartRangeType: string = "common";
    // Chart Range Type for date axis
    public chartRangeTypeForScalarAxis: string = "common";
    // Axis start
    public start: number = null;
    // Axis end
    public end: number = null;
    // Axis color
    public axisColor: string = "#777";
    // Axis Font Size
    public fontSize: number = 11;
    // Axis Font Family
    public fontFamily: string = DefaultFontFamily;
    // Minimum category width
    public minCategoryWidth: number = MinCategoryWidthStartValue;
    // Maximum size
    public maximumSize: number = MaximumSizeStartValue;
    // Concatinate labels
    public concatinateLabels: boolean = true;
    // Display Units
    public displayUnits: number = 0;
    // valueDecimalPlaces
    public precision: number = null;
    // Show Title
    public showTitle: boolean = false;

    public titleStyle: string = "showTitleOnly";
    public titleStyleFull: string = "showTitleOnly";
    public axisTitleColor: string = "#777";
    public axisTitle: string = "";
    public titleFontSize: number = 11;
    public titleFontFamily: string = DefaultFontFamily;
    // Show Gridlines
    public showGridlines: boolean = false;

    public gridlinesColor: string = "#e9e9e9";
    public strokeWidth: number = 1;
    public lineStyle: string = "solid";
}

export class YAxisSettings {
    // Show category axis
    public show: boolean = true;
    // Position
    public position = AxisPosition.Left;
    // Axis Scale type
    public axisScale: string = "linear";
    // Chart Range Type
    public chartRangeType: string = "common";
    // Start value
    public start: number = null;
    // End value
    public end: number = null;
    // Axis color
    public axisColor: string = "#777";
    // Axis Font Size
    public fontSize: number = 11;
    // Axis Font Family
    public fontFamily: string = DefaultFontFamily;
    // Display Units
    public displayUnits: number = 0;
    // valueDecimalPlaces
    public precision: number = null;
    // Show Title
    public showTitle: boolean = false;

    public titleStyle: string = "showTitleOnly";
    public titleStyleFull: string = "showTitleOnly";
    public axisTitleColor: string = "#777";
    public axisTitle: string = "";
    public titleFontSize: number = 11;
    public titleFontFamily: string = DefaultFontFamily;
    // Show Gridlines
    public showGridlines: boolean = true;

    public gridlinesColor: string = "#e9e9e9";
    public strokeWidth: number = 1;
    public lineStyle: string = "solid";
}

export const enum AxisPosition {
    Left = "left",
    Right = "right"
}

export const enum LabelPosition {
    Auto = "auto",
    InsideEnd = "end",
    OutsideEnd = "outside",
    InsideBase = "base",
    InsideCenter = "center"
}

export class DataLabelsSettings {
    // Show category axis
    public show: boolean = false;
    // Axis color
    public color: string = "#777";
    // Display Units
    public displayUnits: number = 0;
    // Value decimal places
    public precision: number = null;
    // Axis Font Size
    public fontSize: number = 9;
    // Axis Font Family
    public fontFamily: string = DataLabelsFontFamily;
    // Show Label Density
    public labelDensity: number = 50;
    // Show Background
    public showBackground: boolean = false;
    // Show Background transparency
    public backgroundColor: string = "#000";
    // Show Background transparency
    public transparency: number = 90;
}

export class DataPointSettings {
    // Fill
    public fill: string = "#01B8AA";
}

export class Shapes {
    public strokeWidth: number = 2;
    public strokeLineJoin: string = "round";
    public lineStyle: string = "solid";

    public showMarkers: boolean = false;
    public markerShape: MarkerShape = MarkerShape.circle;
    public markerSize: number = 5;
    public markerColor: string = "";

    public stepped: boolean = false;
    public customizeSeries: boolean = false;
    //for customizing
    public series: string = "";
}

export class SelectionColor {
    // Fill
    public fill: string = "#777";
}
