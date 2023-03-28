// module powerbi.extensibility.visual {
//     import Selection = d3.Selection;
//     import IValueFormatter = utils.formatting.IValueFormatter;
//
//     export function generateVerticalLineData(categoryIsDate: boolean, xFormatter: IValueFormatter, tooltipFormatter: IValueFormatter, lines: LineDataPoint[],
//         xAxisDataPoints: any[], line: d3.svg.Line<[number,number]>, shapesShowMarkers: boolean, rectGlobalX: number, rectGlobalY: number): VerticalLineDataItem[] {
//         let verticalLineDataItems: VerticalLineDataItem[] = [];
//         for(let i=0;i<xAxisDataPoints.length;i++) {
//             let category: string = convertCategoryItemToString(xAxisDataPoints[i], categoryIsDate);
//             let xValue: number;
//             let points: LinePoint[] = [];
//             let tooltips: VisualTooltipDataItem[] = [];
//             for(let j=0;j<lines.length;j++) {
//                 let linesJ: LineDataPoint = lines[j];
//                 let linePoints: SimplePoint[] = linesJ.points;
//                 if (linePoints) {
//                     for(let k=0;k<linePoints.length;k++) {
//                         let simplePoint: any = linePoints[k];
//                         let xCategory: string = convertCategoryItemToString(simplePoint.x, categoryIsDate);
//                         if (xCategory == category) {
//                             let data: string = line([simplePoint]);
//                             let values: string[] = data.replace('M','').replace('Z','').split(',');
//                             xValue = +values[0];
//                             let yValue: number = +values[1];
//                             let value: string = tooltipFormatter.format(+simplePoint.y);
//                             let showMarkers: boolean = (linesJ.showMarkers == undefined) ? shapesShowMarkers : linesJ.showMarkers;
//                             let linePoint: LinePoint = {
//                                 y: yValue,
//                                 value: value,
//                                 name: linesJ.name,
//                                 color: linesJ.color,
//                                 showMarkers: showMarkers,
//                                 lineKey: linesJ.lineKey,
//                             };
//                             points.push(linePoint);
//                             if (simplePoint.tooltips) {
//                                 for(let k1=0;k1<simplePoint.tooltips.length;k1++) {
//                                     let simplePointTooltip: VisualTooltipDataItem = simplePoint.tooltips[k1];
//                                     let tooltip: VisualTooltipDataItem = {
//                                         displayName: simplePointTooltip.displayName,
//                                         value: simplePointTooltip.value
//                                     };
//                                     if (k1 == 0) {
//                                         let header: PrimitiveValue = xAxisDataPoints[i];
//                                         if (categoryIsDate) {
//                                             header = new Date(header.toString());
//                                         }
//                                         tooltip.header = xFormatter.format(header);
//                                     }
//                                     if (simplePointTooltip.color) {
//                                         tooltip.color = simplePointTooltip.color;
//                                     } else {
//                                         tooltip.color= "black";
//                                         tooltip.opacity = "0";
//                                     }
//                                     tooltips.push(tooltip);
//                                 }
//                             }
//                         }
//                     }
//                 }
//             }
//             if (points.length > 0) {
//                 let verticalLineDataItem: VerticalLineDataItem = {
//                     x: xValue,
//                     tooltips: tooltips,
//                     linePoints: points,
//                     rectGlobalX: rectGlobalX,
//                     rectGlobalY: rectGlobalY
//                 };
//                 verticalLineDataItems.push(verticalLineDataItem);
//             }
//         }
//         return verticalLineDataItems;
//     }
//
//     export function findNearestVerticalLineIndex(mouseX: number, verticalLineDataItems: VerticalLineDataItem[]): number {
//
//         let index: number = 0;
//         let count: number = verticalLineDataItems.length;
//         let xValue: number = count>0
//             ? verticalLineDataItems[0].x
//             : 0;
//         let minDelta: number = Math.abs(xValue - mouseX);
//         for(let j=1;j<count;j++) {
//             xValue = verticalLineDataItems[j].x;
//             let delta = Math.abs(xValue - mouseX);
//             if (minDelta > delta) {
//                 minDelta = delta;
//                 index = j;
//             }
//         }
//         return index;
//     }
//
//     function convertCategoryItemToString(categoryItem: PrimitiveValue, categoryIsDate: boolean): string {
//         if (!categoryItem) return "";
//         let category: string = (categoryIsDate)
//             ? new Date(categoryItem.toString()).toLocaleDateString()
//             : categoryItem.toString();
//         return category;
//     }
//
//     export function drawPointsForVerticalLine(verticalLineContainer: Selection<any>, x: number, points: LinePoint[]) {
//         verticalLineContainer.selectAll("circle").remove();
//         if (!points) return;
//         for(let j=0;j<points.length;j++) {
//             let point: LinePoint = points[j];
//             if (!point.showMarkers) {
//                 verticalLineContainer.append("circle")
//                     .classed(Visual.CircleSelector.className, true)
//                     .attr("cx", x)
//                     .attr("cy", point.y)
//                     .attr("r", DefaultTooltipCircleRadius)
//                     .attr("fill", point.color);
//             }
//         }
//     }
// }
