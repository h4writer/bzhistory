/* global d3 */

var rest = 'https://bugzilla.mozilla.org/rest/',
    bugquery = rest + 'bug?include_fields=' +
        'id,summary,cf_last_resolved,creation_time,assigned_to',
    confquery = rest + 'product?include_fields=' +
        'name,components.name&type=selectable';
var debug = '';//'&chfieldto=Now&chfield=[Bug creation]&chfieldfrom=2013-06-01';

d3.json(bugquery + '&component=Elmo'+debug, processBugs);

var historyData = [];
var summaries = {};
var bugsOverTime, averageBugAge = [];
var mostOpenBugs = 0, mostClosedBugs;

function processBugs(err, result) {
    if (err) {
        console.log(err, 'bugzilla failed');
        return;
    }
    console.log('bugs loaded');
    for (var i=0, ii=result.bugs.length; i < ii; ++i) {
        var bug = result.bugs[i];
        summaries[bug.id] = bug.summary;
        if (bug.creation_time) {
            historyData.push({
                op: 'NEW',
                when: new Date(bug.creation_time),
                id: bug.id
            });
        }
        if (bug.cf_last_resolved) {
            historyData.push({
                op: 'RESOLVED',
                when: new Date(bug.cf_last_resolved),
                who: bug.assigned_to,
                id: bug.id
            });
        }
    }
    historyData.sort(function(bug1, bug2) {return bug1.when - bug2.when;});
    var counts = {up: 0, down: 0};
    var openBugs = {};
    bugsOverTime = historyData.map(function(bug) {
       if (bug.op === 'NEW') {
           ++counts.up;
           openBugs[bug.id] = bug.when;
       }
       else {
           --counts.up;
           ++counts.down;
           delete openBugs[bug.id];
           mostClosedBugs = counts.down;
       }
       var openDays = 0;
       for (var bug_id in openBugs) {
           openDays += (bug.when - openBugs[bug_id])/1000/60/60/24;
       }
       averageBugAge.push({
           when: bug.when,
           average: openDays / counts.up
       });
       mostOpenBugs = Math.max(mostOpenBugs, counts.up);
       return {
           up: counts.up,
           down: counts.down,
           when: bug.when,
           id: bug.id
       };
    });
    showHistory();
}


var margin = {top: 20, right: 50, bottom: 30, left: 50},
    width = document.body.clientWidth - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var x = d3.time.scale()
    .range([0, width]);

var y = d3.scale.linear()
    .range([height, 0]);
var y2 = d3.scale.linear()
    .range([height, 0]);

var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");
var yAxisRight = d3.svg.axis()
    .scale(y2)
    .orient("right");

var area = d3.svg.area()
    .interpolate('step-after')
    .x(function(d) { return x(d.when); })
    .y0(function(d) {return y(0); })
    .y1(function(d) { return y(d.up); });
var area2 = d3.svg.area()
    .interpolate('step-after')
    .x(function(d) { return x(d.when); })
    .y0(function(d) {return y(-d.down); })
    .y1(function(d) { return y(0); });
var line = d3.svg.line()
    .x(function(d) { return x(d.when); })
    .y(function(d) {return y2(d.average); });

var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

function showHistory() {
  document.querySelector('.spinner').style.display = 'none';
  x.domain(d3.extent(bugsOverTime, function(d) { return d.when; }));
  y.domain([-mostClosedBugs, mostOpenBugs]);
  y2.domain(d3.extent(averageBugAge, function(d) {
      return d.average;
  }));

  svg.append("path")
      .datum(bugsOverTime)
      .attr("class", "open")
      .attr("d", area);
  svg.append("path")
      .datum(bugsOverTime)
      .attr("class", "closed")
      .attr("d", area2);
  svg.append("path")
      .datum(averageBugAge)
      .attr("class", "average")
      .attr("d", line);

  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Bugs");
  svg.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(" + width + ",0)")
      .call(yAxisRight)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Age");
}