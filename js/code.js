/* global d3 */

var rest = 'https://bugzilla.mozilla.org/rest/',
    bugquery = rest + 'bug?include_fields=' +
        'id,summary,cf_last_resolved,creation_time,assigned_to' +
        '&resolution=---&resolution=FIXED',
    confquery = rest + 'product?include_fields=' +
        'name,components.name&type=selectable';
var debug = '';//'&chfieldto=Now&chfield=[Bug creation]&chfieldfrom=2013-06-01';

d3.json(bugquery + '&component=JavaScript Engine%3A JIT'+debug, processBugs);

var historyData = [];
var summaries = {};
var bugsOverTime, averageBugAge = [], assignedOverTime = [], assignees;
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
    var assignedBugs = {};
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
           assignedBugs[bug.who] = (assignedBugs[bug.who] || 0) + 1;
           var _entry = {
               when: bug.when
           };
           for (var p in assignedBugs) {
               _entry[p] = assignedBugs[p];
           }
           assignedOverTime.push(_entry);
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
    height = 800 - margin.top - margin.bottom;

var x = d3.time.scale()
    .range([0, width]);

var openBugsScale = d3.scale.linear()
    .range([height, height/2, 0]);
var ageScale = d3.scale.linear()
    .range([height, 0]);
var color = d3.scale.category20();

var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

var openBugsAxis = d3.svg.axis()
    .scale(openBugsScale)
    .orient("left");
var ageAxis = d3.svg.axis()
    .scale(ageScale)
    .orient("right");

var area = d3.svg.area()
    .interpolate('step-after')
    .x(function(d) { return x(d.when); })
    .y0(function(d) {return openBugsScale(0); })
    .y1(function(d) { return openBugsScale(d.up); });
var line = d3.svg.line()
    .x(function(d) { return x(d.when); })
    .y(function(d) {return ageScale(d.average); });
var stack = d3.layout.stack()
    .order(function(data) {
      var toSort = data.map(function(values, i) {
        return {
          order: i,
          value: values[values.length - 1][1]
        };
      });
      toSort.sort(function(l, r) {return r.value - l.value;});
      return toSort.map(function(entry) {return entry.order;});
    })
    .values(function(d) { return d.values; });
var stackarea = d3.svg.area()
    .x(function(d) { return x(d.when); })
    .y0(function(d) {
      return openBugsScale(-d.y0);
      })
    .y1(function(d) {
      return openBugsScale(-d.y0 - d.y);
      });

var svg = d3.select("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

function showHistory() {
  document.querySelector('.spinner').style.display = 'none';
  x.domain(d3.extent(bugsOverTime, function(d) { return d.when; }));
  openBugsScale.domain([-mostClosedBugs, 0, mostOpenBugs]);
  ageScale.domain(d3.extent(averageBugAge, function(d) {
      return d.average;
  }));
  color.domain(d3.keys(assignedOverTime[assignedOverTime.length - 1])
    .filter(function(key) { return key !== "when"; }));
  assignees = stack(color.domain().map(
    function(name) {
      return {
        name: name,
        values:assignedOverTime.map(function(d){
          return {
            when: d.when,
            y: d[name] || 0
          };
        })
      };
    }
  ));
  svg.selectAll(".assigned")
      .data(assignees).enter().append("g")
      .attr("class", "assigned")
    .append("path")
      .attr("class", "area")
      .attr("d", function(d) { return stackarea(d.values); })
      .style("fill", function(d) { return color(d.name); })
      .append("title").text(function(d) { return d.name; });

  svg.append("path")
      .datum(bugsOverTime)
      .attr("class", "open")
      .attr("d", area);
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
      .call(openBugsAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Bugs");
  svg.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(" + width + ",0)")
      .call(ageAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Age");
}
