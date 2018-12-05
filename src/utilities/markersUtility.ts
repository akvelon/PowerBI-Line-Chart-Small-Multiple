module powerbi.extensibility.visual {
    "use strict";
    export class MarkersUtility {
        public static initMarker(container: d3.Selection<any>, uniqueName: string, markerShape: string, markerSize: number, markerColor:string): string {
            //set markerD and strokeWidth from markerShape
            let markerD: string = "";
            let strokeWidth: number = 0;
            switch (markerShape) {
                case "circle" : {
                    markerD = "M 0 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0";
                    break;
                }
                case "square" : {
                    markerD = "M 0 0 m -5 -5 l 10 0 l 0 10 l -10 0 z";
                    break;
                }
                case "diamond" : {
                    markerD = "M 0 0 m -5 0 l 5 -5 l 5 5 l -5 5 z";
                    break;
                }
                case "triangle" : {
                    markerD = "M 0 0 m -5 5 l 5 -10 l 5 10 z";
                    break;
                }
                case "x" : {
                    markerD = "M 0 0 m -5 -5 l 10 10 m -10 0 l 10 -10";
                    strokeWidth = 1;
                    break;
                }
                case "shortDash" : {
                    markerD = "M 0 0 l 5 0";
                    strokeWidth = 2;
                    break;
                }
                case "longDash" : {
                    markerD = "M 0 0 m -5 0 l 10 0";
                    strokeWidth = 2;
                    break;
                }
                case "plus" : {
                    markerD = "M 0 0 m -5 0 l 10 0 m -5 -5 l 0 10";
                    strokeWidth = 1;
                    break;
                }
            }
            let markerId: string;
            //init marker
            if (markerD !== "") {
                markerId = MarkersUtility.retrieveMarkerName(uniqueName, markerShape);
                let isMarkerNotExists = container.select("#" + markerId).empty();
                if (isMarkerNotExists) {
                    let marker = container.append('marker')
                        .attr('id', markerId)
                        .attr('refX', 0)
                        .attr('refY', 0)
                        .attr('viewBox', '-6 -6 12 12')
                        .attr('markerWidth', markerSize)
                        .attr('markerHeight', markerSize);
                    marker.append("path")
                        .attr("d", markerD)
                        .attr("stroke", markerColor)
                        .attr("stroke-width", strokeWidth)
                        .attr("fill", markerColor);
                }
            }
            return markerId;
        }

        public static retrieveMarkerName(uniqueName: string, markerShape: string): string {
            let markerId: string = markerShape + uniqueName;
            markerId = markerId.replace(/\+/g, 'plus');
            markerId = markerId.replace(/[^0-9a-zA-Z]/g, '');
            return markerId;
        }

        public static getDataLineForForSteppedLineChart(dataLine: string):string {
            let newDataLine: string = dataLine.replace(/\M/, '').replace(/\V/g, '!V').replace(/\H/g, '!H').replace(/\L/g, '!L');
            let markedPoints: string[] = newDataLine.replace(/\M/g, '!M').split('!');

            newDataLine = "M" + markedPoints[0];
            let firstItem: string[] = markedPoints[0].split(',');
            let currentX: number = +firstItem[0];
            let currentY: number = +firstItem[1];

            let j: number = 1;
            while(j<markedPoints.length) {
                let action: string = markedPoints[j][0];
                switch (action) {
                    case 'H': {
                        let newX: number = +markedPoints[j].replace(/\H/, '');
                        let newDelta: number = newX - currentX;
                        currentX = newX;
                        newDataLine = newDataLine + markedPoints[j];
                        break;
                    }
                    case 'V': {
                        let newY: number = +markedPoints[j].replace(/\V/, '');
                        currentY = newY;
                        newDataLine = newDataLine + markedPoints[j];
                        break;
                    }
                    case 'M': {
                        let data: string[] = markedPoints[j].replace(/\M/, '').split(',');
                        currentX = +data[0];
                        currentY = +data[1];
                        newDataLine = newDataLine + markedPoints[j];
                        break;
                    }
                    case 'L': {
                        let data: string[] = markedPoints[j].replace(/\L/, '').split(',');
                        let newX: number = +data[0];
                        let newY: number = +data[1];
                        let newX1: number = (newX + currentX) / 2;
                        newDataLine = newDataLine + "H" + newX1 + "V" + newY + "H" + newX;
                        currentX = newX;
                        currentY = newY;
                        break;
                    }
                }
                j = j + 1;
            }
            return newDataLine;
        }

        public static drawMarkersForSteppedLineChart(container: d3.Selection<SVGElement>, lineD: string, markerPathId: string, markerId: string, strokeWidth: number) {
            let markerAttr = 'url(#' + markerId + ')';
            container.append("path")
                .classed(Visual.MarkerLineSelector.className, true)
                .attr("id", markerPathId)
                .attr("d", lineD)
                .attr('stroke-width', strokeWidth)
                .attr('fill', 'none')
                .attr('marker-start', markerAttr)
                .attr('marker-mid', markerAttr)
                .attr('marker-end', markerAttr);
        }
    }
}