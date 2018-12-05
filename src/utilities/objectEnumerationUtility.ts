module powerbi.extensibility.visual {
    export class EnumerateObject {

        public static setInstances(
            settings: VisualSettings,
            instanceEnumeration: VisualObjectInstanceEnumeration,
            model: VisualViewModel) {

            let instances: VisualObjectInstance[] = (instanceEnumeration as VisualObjectInstanceEnumerationObject).instances;
            let instance: VisualObjectInstance = instances[0];

            switch (instance.objectName) {
                case "smallMultiple": {
                    if (settings.smallMultiple.enable) {
                        if (settings.smallMultiple.layoutMode == "Matrix") {
                            delete instance.properties["minRowWidth"];
                            delete instance.properties["showEmptySmallMultiples"];
                        }
                        if (!settings.smallMultiple.showChartTitle) {
                            delete instance.properties["smColor"];
                            delete instance.properties["fontSize"];
                            delete instance.properties["fontFamily"];
                        }
                    } else {
                        instances.pop();
                    }
                    break;
                }
                case "legend": {
                    if (settings.legend.style != "markers") {
                        delete instance.properties["matchLineColor"];
                        delete instance.properties["circleDefaultIcon"];
                    }
                    if (model.legendDataPoint.length <= 1) {
                        instances.pop();
                    }
                    break;
                }
                case "xAxis": {
                    if (settings.xAxis.showTitle) {
                        if (model.categoryIsScalar && (settings.xAxis.displayUnits == 1000 ||
                            settings.xAxis.displayUnits == 1000000 ||settings.xAxis.displayUnits == 1000000000 ||settings.xAxis.displayUnits == 1000000000000)) {
                            delete instance.properties["titleStyle"];
                        } else {
                            delete instance.properties["titleStyleFull"];
                        }
                    } else {
                        delete instance.properties["titleStyle"];
                        delete instance.properties["titleStyleFull"];
                        delete instance.properties["axisTitleColor"];
                        delete instance.properties["axisTitle"];
                        delete instance.properties["titleFontSize"];
                        delete instance.properties["titleFontFamily"];
                    }
                    if (!settings.xAxis.showGridlines) {
                        delete instance.properties["gridlinesColor"];
                        delete instance.properties["strokeWidth"];
                        delete instance.properties["lineStyle"];
                    }
                    if (!model.categoryIsDate) {
                        delete instance.properties["concatinateLabels"];
                    } else {
                        delete instance.properties["axisScale"];
                    }
                    if (model.categoryIsScalar) {
                        delete instance.properties["chartRangeType"];
                        if (settings.xAxis.chartRangeTypeForScalarAxis != "custom") {
                            delete instance.properties["start"];
                            delete instance.properties["end"];
                        }
                    } else {
                        delete instance.properties["chartRangeTypeForScalarAxis"];
                        delete instance.properties["start"];
                        delete instance.properties["end"];
                        delete instance.properties["displayUnits"];
                        delete instance.properties["precision"];
                    }
                    if (settings.xAxis.axisType === "categorical") {
                        delete instance.properties["axisScale"];
                        delete instance.properties["axisStyle"];
                    } else {
                        delete instance.properties["minCategoryWidth"];
                        delete instance.properties["maximumSize"];
                        delete instance.properties["concatinateLabels"];
                    }

                    break;
                }
                case "yAxis": {
                    if (settings.yAxis.chartRangeType != "custom") {
                        delete instance.properties["start"];
                        delete instance.properties["end"];
                    }
                    if (settings.yAxis.showTitle) {
                        if (settings.yAxis.displayUnits == 1000 || settings.yAxis.displayUnits == 1000000 ||
                            settings.yAxis.displayUnits == 1000000000 ||settings.yAxis.displayUnits == 1000000000000) {
                            delete instance.properties["titleStyle"];
                        } else {
                            delete instance.properties["titleStyleFull"];
                        }
                    } else {
                        delete instance.properties["titleStyle"];
                        delete instance.properties["titleStyleFull"];
                        delete instance.properties["axisTitleColor"];
                        delete instance.properties["axisTitle"];
                        delete instance.properties["titleFontSize"];
                        delete instance.properties["titleFontFamily"];
                    }
                    if (!settings.yAxis.showGridlines) {
                        delete instance.properties["gridlinesColor"];
                        delete instance.properties["strokeWidth"];
                        delete instance.properties["lineStyle"];
                    }

                    break;
                }
                case "dataPoint": {
                    instances.pop();
                    for(let i=0;i<model.legendDataPoint.length;i++) {

                        let legendDataPoint: LegendDataPointExtended = model.legendDataPoint[i];
                        let objIns: VisualObjectInstance = {
                            objectName: instance.objectName,
                            displayName: legendDataPoint.label,
                            selector: (legendDataPoint.identity as powerbi.visuals.ISelectionId).getSelector(),
                            properties: {
                                fill: { solid: { color: legendDataPoint.color } }
                            }
                        }
                        instances.push(objIns);
                    }

                    break;
                }
                case "dataLabels": {
                    if (settings.xAxis.axisType === "categorical") {
                        delete instance.properties["labelDensity"];
                    }
                    if (!settings.dataLabels.showBackground) {
                        delete instance.properties["backgroundColor"];
                        delete instance.properties["transparency"];
                    }

                    break;
                }
                case "shapes": {
                    if (settings.xAxis.axisType == "categorical") {
                        if (!settings.shapes.showMarkers) {
                            delete instance.properties["markerShape"];
                            delete instance.properties["markerSize"];
                            delete instance.properties["markerColor"];
                        }
                    } else {
                        settings.shapes.showMarkers = false;
                        delete instance.properties["showMarkers"];
                        delete instance.properties["markerShape"];
                        delete instance.properties["markerSize"];
                        delete instance.properties["markerColor"];
                    }

                    if (model.legendDataPoint.length > 1) {
                        if (settings.shapes.customizeSeries) {
                            let series: string = settings.shapes.series;
                            let lineDataPoint: LineDataPoint = null;
                            for(let i=0;i<model.lines.length;i++) {
                                let item: LineDataPoint = model.lines[i];
                                let itemName: PrimitiveValue = model.legendType == CategoryType.Date ? new Date(item.name) : item.name;
                                let itemValue: string = model.legendFormatter ? model.legendFormatter.format(itemName) : item.name;
                                if (itemValue == series) {
                                    lineDataPoint = item;
                                    break;
                                }
                            }
                            if (lineDataPoint!=null) {

                                let strokeWidth: number = (lineDataPoint.strokeWidth != null)
                                    ? lineDataPoint.strokeWidth
                                    : settings.shapes.strokeWidth;
                                let strokeLineJoin: string = (lineDataPoint.strokeLineJoin != null)
                                    ? lineDataPoint.strokeLineJoin
                                    : settings.shapes.strokeLineJoin;
                                let lineStyle: string = (lineDataPoint.lineStyle != null)
                                    ? lineDataPoint.lineStyle
                                    : settings.shapes.lineStyle;
                                let showMarkers: boolean = (lineDataPoint.showMarkers != null)
                                    ? lineDataPoint.showMarkers
                                    : settings.shapes.showMarkers;
                                let markerShape: string = (lineDataPoint.markerShape != null)
                                    ? lineDataPoint.markerShape
                                    : settings.shapes.markerShape;
                                let markerSize: number = (lineDataPoint.markerSize != null)
                                    ? lineDataPoint.markerSize
                                    : settings.shapes.markerSize;
                                let markerColor: string = (lineDataPoint.markerColor != null)
                                    ? lineDataPoint.markerColor
                                    : settings.shapes.markerColor;
                                let stepped: boolean = (lineDataPoint.stepped != null)
                                    ? lineDataPoint.stepped
                                    : settings.shapes.stepped;

                                let properties = {
                                    "seriesStrokeWidth": strokeWidth,
                                    "seriesStrokeLineJoin": strokeLineJoin,
                                    "seriesLineStyle": lineStyle
                                };
                                if (settings.xAxis.axisType === "categorical") {
                                    properties["seriesShowMarkers"] = showMarkers;
                                    if (showMarkers) {
                                        properties["seriesMarkerShape"] = markerShape;
                                        properties["seriesMarkerSize"] = markerSize;
                                        properties["seriesMarkerColor"] = markerColor;
                                    }
                                }
                                properties["seriesStepped"] = stepped;
                                let objIns: VisualObjectInstance = {
                                    objectName: instance.objectName,
                                    properties: properties,
                                    selector: (lineDataPoint.identity as powerbi.visuals.ISelectionId).getSelector(),
                                };
                                instances.push(objIns);
                            }

                        } else {
                            delete instance.properties["series"];
                            delete instance.properties["seriesStrokeWidth"];
                            delete instance.properties["seriesStrokeLineJoin"];
                            delete instance.properties["seriesLineStyle"];
                            delete instance.properties["seriesShowMarkers"];
                            delete instance.properties["seriesMarkerShape"];
                            delete instance.properties["seriesMarkerSize"];
                            delete instance.properties["seriesMarkerColor"];
                            delete instance.properties["seriesStepped"];
                        }
                    }  else {
                        delete instance.properties["customizeSeries"];
                        delete instance.properties["series"];
                        delete instance.properties["seriesStrokeWidth"];
                        delete instance.properties["seriesStrokeLineJoin"];
                        delete instance.properties["seriesLineStyle"];
                        delete instance.properties["seriesShowMarkers"];
                        delete instance.properties["seriesMarkerShape"];
                        delete instance.properties["seriesMarkerSize"];
                        delete instance.properties["seriesMarkerColor"];
                        delete instance.properties["seriesStepped"];
                    }
                    break;
                }
            }
        }
    }
}