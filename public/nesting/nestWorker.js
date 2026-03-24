(() => {
  // src/util/nestWorker.js
  (() => {
    var TOL = Math.pow(10, -9);
    function _almostEqual(a, b, tolerance) {
      if (!tolerance) {
        tolerance = TOL;
      }
      return Math.abs(a - b) < tolerance;
    }
    function _withinDistance(p1, p2, distance) {
      var dx = p1.x - p2.x;
      var dy = p1.y - p2.y;
      return dx * dx + dy * dy < distance * distance;
    }
    function _degreesToRadians(angle) {
      return angle * (Math.PI / 180);
    }
    function _radiansToDegrees(angle) {
      return angle * (180 / Math.PI);
    }
    function _normalizeVector(v) {
      if (_almostEqual(v.x * v.x + v.y * v.y, 1)) {
        return v;
      }
      var len = Math.sqrt(v.x * v.x + v.y * v.y);
      var inverse = 1 / len;
      return {
        x: v.x * inverse,
        y: v.y * inverse
      };
    }
    function _onSegment(A, B, p) {
      if (_almostEqual(A.x, B.x) && _almostEqual(p.x, A.x)) {
        if (!_almostEqual(p.y, B.y) && !_almostEqual(p.y, A.y) && p.y < Math.max(B.y, A.y) && p.y > Math.min(B.y, A.y)) {
          return true;
        } else {
          return false;
        }
      }
      if (_almostEqual(A.y, B.y) && _almostEqual(p.y, A.y)) {
        if (!_almostEqual(p.x, B.x) && !_almostEqual(p.x, A.x) && p.x < Math.max(B.x, A.x) && p.x > Math.min(B.x, A.x)) {
          return true;
        } else {
          return false;
        }
      }
      if (p.x < A.x && p.x < B.x || p.x > A.x && p.x > B.x || p.y < A.y && p.y < B.y || p.y > A.y && p.y > B.y) {
        return false;
      }
      if (_almostEqual(p.x, A.x) && _almostEqual(p.y, A.y) || _almostEqual(p.x, B.x) && _almostEqual(p.y, B.y)) {
        return false;
      }
      var cross = (p.y - A.y) * (B.x - A.x) - (p.x - A.x) * (B.y - A.y);
      if (Math.abs(cross) > TOL) {
        return false;
      }
      var dot = (p.x - A.x) * (B.x - A.x) + (p.y - A.y) * (B.y - A.y);
      if (dot < 0 || _almostEqual(dot, 0)) {
        return false;
      }
      var len2 = (B.x - A.x) * (B.x - A.x) + (B.y - A.y) * (B.y - A.y);
      if (dot > len2 || _almostEqual(dot, len2)) {
        return false;
      }
      return true;
    }
    function _lineIntersect(A, B, E, F, infinite) {
      var a1, a2, b1, b2, c1, c2, x, y;
      a1 = B.y - A.y;
      b1 = A.x - B.x;
      c1 = B.x * A.y - A.x * B.y;
      a2 = F.y - E.y;
      b2 = E.x - F.x;
      c2 = F.x * E.y - E.x * F.y;
      var denom = a1 * b2 - a2 * b1;
      x = (b1 * c2 - b2 * c1) / denom, y = (a2 * c1 - a1 * c2) / denom;
      if (!isFinite(x) || !isFinite(y)) {
        return null;
      }
      if (!infinite) {
        if (Math.abs(A.x - B.x) > TOL && (A.x < B.x ? x < A.x || x > B.x : x > A.x || x < B.x)) return null;
        if (Math.abs(A.y - B.y) > TOL && (A.y < B.y ? y < A.y || y > B.y : y > A.y || y < B.y)) return null;
        if (Math.abs(E.x - F.x) > TOL && (E.x < F.x ? x < E.x || x > F.x : x > E.x || x < F.x)) return null;
        if (Math.abs(E.y - F.y) > TOL && (E.y < F.y ? y < E.y || y > F.y : y > E.y || y < F.y)) return null;
      }
      return { x, y };
    }
    var GeometryUtil = {
      withinDistance: _withinDistance,
      lineIntersect: _lineIntersect,
      almostEqual: _almostEqual,
      // Bezier algos from http://algorithmist.net/docs/subdivision.pdf
      QuadraticBezier: {
        // Roger Willcocks bezier flatness criterion
        isFlat: function(p1, p2, c1, tol) {
          tol = 4 * tol * tol;
          var ux = 2 * c1.x - p1.x - p2.x;
          ux *= ux;
          var uy = 2 * c1.y - p1.y - p2.y;
          uy *= uy;
          return ux + uy <= tol;
        },
        // turn Bezier into line segments via de Casteljau, returns an array of points
        linearize: function(p1, p2, c1, tol) {
          var finished = [p1];
          var todo = [{ p1, p2, c1 }];
          while (todo.length > 0) {
            var segment = todo[0];
            if (this.isFlat(segment.p1, segment.p2, segment.c1, tol)) {
              finished.push({ x: segment.p2.x, y: segment.p2.y });
              todo.shift();
            } else {
              var divided = this.subdivide(segment.p1, segment.p2, segment.c1, 0.5);
              todo.splice(0, 1, divided[0], divided[1]);
            }
          }
          return finished;
        },
        // subdivide a single Bezier
        // t is the percent along the Bezier to divide at. eg. 0.5
        subdivide: function(p1, p2, c1, t) {
          var mid1 = {
            x: p1.x + (c1.x - p1.x) * t,
            y: p1.y + (c1.y - p1.y) * t
          };
          var mid2 = {
            x: c1.x + (p2.x - c1.x) * t,
            y: c1.y + (p2.y - c1.y) * t
          };
          var mid3 = {
            x: mid1.x + (mid2.x - mid1.x) * t,
            y: mid1.y + (mid2.y - mid1.y) * t
          };
          var seg1 = { p1, p2: mid3, c1: mid1 };
          var seg2 = { p1: mid3, p2, c1: mid2 };
          return [seg1, seg2];
        }
      },
      CubicBezier: {
        isFlat: function(p1, p2, c1, c2, tol) {
          tol = 16 * tol * tol;
          var ux = 3 * c1.x - 2 * p1.x - p2.x;
          ux *= ux;
          var uy = 3 * c1.y - 2 * p1.y - p2.y;
          uy *= uy;
          var vx = 3 * c2.x - 2 * p2.x - p1.x;
          vx *= vx;
          var vy = 3 * c2.y - 2 * p2.y - p1.y;
          vy *= vy;
          if (ux < vx) {
            ux = vx;
          }
          if (uy < vy) {
            uy = vy;
          }
          return ux + uy <= tol;
        },
        linearize: function(p1, p2, c1, c2, tol) {
          var finished = [p1];
          var todo = [{ p1, p2, c1, c2 }];
          while (todo.length > 0) {
            var segment = todo[0];
            if (this.isFlat(segment.p1, segment.p2, segment.c1, segment.c2, tol)) {
              finished.push({ x: segment.p2.x, y: segment.p2.y });
              todo.shift();
            } else {
              var divided = this.subdivide(segment.p1, segment.p2, segment.c1, segment.c2, 0.5);
              todo.splice(0, 1, divided[0], divided[1]);
            }
          }
          return finished;
        },
        subdivide: function(p1, p2, c1, c2, t) {
          var mid1 = {
            x: p1.x + (c1.x - p1.x) * t,
            y: p1.y + (c1.y - p1.y) * t
          };
          var mid2 = {
            x: c2.x + (p2.x - c2.x) * t,
            y: c2.y + (p2.y - c2.y) * t
          };
          var mid3 = {
            x: c1.x + (c2.x - c1.x) * t,
            y: c1.y + (c2.y - c1.y) * t
          };
          var mida = {
            x: mid1.x + (mid3.x - mid1.x) * t,
            y: mid1.y + (mid3.y - mid1.y) * t
          };
          var midb = {
            x: mid3.x + (mid2.x - mid3.x) * t,
            y: mid3.y + (mid2.y - mid3.y) * t
          };
          var midx = {
            x: mida.x + (midb.x - mida.x) * t,
            y: mida.y + (midb.y - mida.y) * t
          };
          var seg1 = { p1, p2: midx, c1: mid1, c2: mida };
          var seg2 = { p1: midx, p2, c1: midb, c2: mid2 };
          return [seg1, seg2];
        }
      },
      Arc: {
        linearize: function(p1, p2, rx, ry, angle, largearc, sweep, tol) {
          var finished = [p2];
          var arc = this.svgToCenter(p1, p2, rx, ry, angle, largearc, sweep);
          var todo = [arc];
          while (todo.length > 0) {
            arc = todo[0];
            var fullarc = this.centerToSvg(arc.center, arc.rx, arc.ry, arc.theta, arc.extent, arc.angle);
            var subarc = this.centerToSvg(arc.center, arc.rx, arc.ry, arc.theta, 0.5 * arc.extent, arc.angle);
            var arcmid = subarc.p2;
            var mid = {
              x: 0.5 * (fullarc.p1.x + fullarc.p2.x),
              y: 0.5 * (fullarc.p1.y + fullarc.p2.y)
            };
            if (_withinDistance(mid, arcmid, tol)) {
              finished.unshift(fullarc.p2);
              todo.shift();
            } else {
              var arc1 = {
                center: arc.center,
                rx: arc.rx,
                ry: arc.ry,
                theta: arc.theta,
                extent: 0.5 * arc.extent,
                angle: arc.angle
              };
              var arc2 = {
                center: arc.center,
                rx: arc.rx,
                ry: arc.ry,
                theta: arc.theta + 0.5 * arc.extent,
                extent: 0.5 * arc.extent,
                angle: arc.angle
              };
              todo.splice(0, 1, arc1, arc2);
            }
          }
          return finished;
        },
        // convert from center point/angle sweep definition to SVG point and flag definition of arcs
        // ported from http://commons.oreilly.com/wiki/index.php/SVG_Essentials/Paths
        centerToSvg: function(center, rx, ry, theta1, extent, angleDegrees) {
          var theta2 = theta1 + extent;
          theta1 = _degreesToRadians(theta1);
          theta2 = _degreesToRadians(theta2);
          var angle = _degreesToRadians(angleDegrees);
          var cos = Math.cos(angle);
          var sin = Math.sin(angle);
          var t1cos = Math.cos(theta1);
          var t1sin = Math.sin(theta1);
          var t2cos = Math.cos(theta2);
          var t2sin = Math.sin(theta2);
          var x0 = center.x + cos * rx * t1cos + -sin * ry * t1sin;
          var y0 = center.y + sin * rx * t1cos + cos * ry * t1sin;
          var x1 = center.x + cos * rx * t2cos + -sin * ry * t2sin;
          var y1 = center.y + sin * rx * t2cos + cos * ry * t2sin;
          var largearc = extent > 180 ? 1 : 0;
          var sweep = extent > 0 ? 1 : 0;
          return {
            p1: { x: x0, y: y0 },
            p2: { x: x1, y: y1 },
            rx,
            ry,
            angle,
            largearc,
            sweep
          };
        },
        // convert from SVG format arc to center point arc
        svgToCenter: function(p1, p2, rx, ry, angleDegrees, largearc, sweep) {
          var mid = {
            x: 0.5 * (p1.x + p2.x),
            y: 0.5 * (p1.y + p2.y)
          };
          var diff = {
            x: 0.5 * (p2.x - p1.x),
            y: 0.5 * (p2.y - p1.y)
          };
          var angle = _degreesToRadians(angleDegrees % 360);
          var cos = Math.cos(angle);
          var sin = Math.sin(angle);
          var x1 = cos * diff.x + sin * diff.y;
          var y1 = -sin * diff.x + cos * diff.y;
          rx = Math.abs(rx);
          ry = Math.abs(ry);
          var Prx = rx * rx;
          var Pry = ry * ry;
          var Px1 = x1 * x1;
          var Py1 = y1 * y1;
          var radiiCheck = Px1 / Prx + Py1 / Pry;
          var radiiSqrt = Math.sqrt(radiiCheck);
          if (radiiCheck > 1) {
            rx = radiiSqrt * rx;
            ry = radiiSqrt * ry;
            Prx = rx * rx;
            Pry = ry * ry;
          }
          var sign = largearc != sweep ? -1 : 1;
          var sq = (Prx * Pry - Prx * Py1 - Pry * Px1) / (Prx * Py1 + Pry * Px1);
          sq = sq < 0 ? 0 : sq;
          var coef = sign * Math.sqrt(sq);
          var cx1 = coef * (rx * y1 / ry);
          var cy1 = coef * -(ry * x1 / rx);
          var cx = mid.x + (cos * cx1 - sin * cy1);
          var cy = mid.y + (sin * cx1 + cos * cy1);
          var ux = (x1 - cx1) / rx;
          var uy = (y1 - cy1) / ry;
          var vx = (-x1 - cx1) / rx;
          var vy = (-y1 - cy1) / ry;
          var n = Math.sqrt(ux * ux + uy * uy);
          var p = ux;
          sign = uy < 0 ? -1 : 1;
          var theta = sign * Math.acos(p / n);
          theta = _radiansToDegrees(theta);
          n = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
          p = ux * vx + uy * vy;
          sign = ux * vy - uy * vx < 0 ? -1 : 1;
          var delta = sign * Math.acos(p / n);
          delta = _radiansToDegrees(delta);
          if (sweep == 1 && delta > 0) {
            delta -= 360;
          } else if (sweep == 0 && delta < 0) {
            delta += 360;
          }
          delta %= 360;
          theta %= 360;
          return {
            center: { x: cx, y: cy },
            rx,
            ry,
            theta,
            extent: delta,
            angle: angleDegrees
          };
        }
      },
      // returns the rectangular bounding box of the given polygon
      getPolygonBounds: function(polygon) {
        if (!polygon || polygon.length < 3) {
          return null;
        }
        var xmin = polygon[0].x;
        var xmax = polygon[0].x;
        var ymin = polygon[0].y;
        var ymax = polygon[0].y;
        for (var i = 1; i < polygon.length; i++) {
          if (polygon[i].x > xmax) {
            xmax = polygon[i].x;
          } else if (polygon[i].x < xmin) {
            xmin = polygon[i].x;
          }
          if (polygon[i].y > ymax) {
            ymax = polygon[i].y;
          } else if (polygon[i].y < ymin) {
            ymin = polygon[i].y;
          }
        }
        return {
          x: xmin,
          y: ymin,
          width: xmax - xmin,
          height: ymax - ymin
        };
      },
      // return true if point is in the polygon, false if outside, and null if exactly on a point or edge
      pointInPolygon: function(point, polygon) {
        if (!polygon || polygon.length < 3) {
          return null;
        }
        var inside = false;
        var offsetx = polygon.offsetx || 0;
        var offsety = polygon.offsety || 0;
        for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          var xi = polygon[i].x + offsetx;
          var yi = polygon[i].y + offsety;
          var xj = polygon[j].x + offsetx;
          var yj = polygon[j].y + offsety;
          if (_almostEqual(xi, point.x) && _almostEqual(yi, point.y)) {
            return null;
          }
          if (_onSegment({ x: xi, y: yi }, { x: xj, y: yj }, point)) {
            return null;
          }
          if (_almostEqual(xi, xj) && _almostEqual(yi, yj)) {
            continue;
          }
          var intersect = yi > point.y != yj > point.y && point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi;
          if (intersect) inside = !inside;
        }
        return inside;
      },
      // returns the area of the polygon, assuming no self-intersections
      // a negative area indicates counter-clockwise winding direction
      polygonArea: function(polygon) {
        var area = 0;
        var i, j;
        for (i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
        }
        return 0.5 * area;
      },
      // todo: swap this for a more efficient sweep-line implementation
      // returnEdges: if set, return all edges on A that have intersections
      intersect: function(A, B) {
        var Aoffsetx = A.offsetx || 0;
        var Aoffsety = A.offsety || 0;
        var Boffsetx = B.offsetx || 0;
        var Boffsety = B.offsety || 0;
        A = A.slice(0);
        B = B.slice(0);
        for (var i = 0; i < A.length - 1; i++) {
          for (var j = 0; j < B.length - 1; j++) {
            var a1 = { x: A[i].x + Aoffsetx, y: A[i].y + Aoffsety };
            var a2 = { x: A[i + 1].x + Aoffsetx, y: A[i + 1].y + Aoffsety };
            var b1 = { x: B[j].x + Boffsetx, y: B[j].y + Boffsety };
            var b2 = { x: B[j + 1].x + Boffsetx, y: B[j + 1].y + Boffsety };
            var prevbindex = j == 0 ? B.length - 1 : j - 1;
            var prevaindex = i == 0 ? A.length - 1 : i - 1;
            var nextbindex = j + 1 == B.length - 1 ? 0 : j + 2;
            var nextaindex = i + 1 == A.length - 1 ? 0 : i + 2;
            if (B[prevbindex] == B[j] || _almostEqual(B[prevbindex].x, B[j].x) && _almostEqual(B[prevbindex].y, B[j].y)) {
              prevbindex = prevbindex == 0 ? B.length - 1 : prevbindex - 1;
            }
            if (A[prevaindex] == A[i] || _almostEqual(A[prevaindex].x, A[i].x) && _almostEqual(A[prevaindex].y, A[i].y)) {
              prevaindex = prevaindex == 0 ? A.length - 1 : prevaindex - 1;
            }
            if (B[nextbindex] == B[j + 1] || _almostEqual(B[nextbindex].x, B[j + 1].x) && _almostEqual(B[nextbindex].y, B[j + 1].y)) {
              nextbindex = nextbindex == B.length - 1 ? 0 : nextbindex + 1;
            }
            if (A[nextaindex] == A[i + 1] || _almostEqual(A[nextaindex].x, A[i + 1].x) && _almostEqual(A[nextaindex].y, A[i + 1].y)) {
              nextaindex = nextaindex == A.length - 1 ? 0 : nextaindex + 1;
            }
            var a0 = { x: A[prevaindex].x + Aoffsetx, y: A[prevaindex].y + Aoffsety };
            var b0 = { x: B[prevbindex].x + Boffsetx, y: B[prevbindex].y + Boffsety };
            var a3 = { x: A[nextaindex].x + Aoffsetx, y: A[nextaindex].y + Aoffsety };
            var b3 = { x: B[nextbindex].x + Boffsetx, y: B[nextbindex].y + Boffsety };
            if (_onSegment(a1, a2, b1) || _almostEqual(a1.x, b1.x) && _almostEqual(a1.y, b1.y)) {
              var b0in = this.pointInPolygon(b0, A);
              var b2in = this.pointInPolygon(b2, A);
              if (b0in === true && b2in === false || b0in === false && b2in === true) {
                return true;
              } else {
                continue;
              }
            }
            if (_onSegment(a1, a2, b2) || _almostEqual(a2.x, b2.x) && _almostEqual(a2.y, b2.y)) {
              var b1in = this.pointInPolygon(b1, A);
              var b3in = this.pointInPolygon(b3, A);
              if (b1in === true && b3in === false || b1in === false && b3in === true) {
                return true;
              } else {
                continue;
              }
            }
            if (_onSegment(b1, b2, a1) || _almostEqual(a1.x, b2.x) && _almostEqual(a1.y, b2.y)) {
              var a0in = this.pointInPolygon(a0, B);
              var a2in = this.pointInPolygon(a2, B);
              if (a0in === true && a2in === false || a0in === false && a2in === true) {
                return true;
              } else {
                continue;
              }
            }
            if (_onSegment(b1, b2, a2) || _almostEqual(a2.x, b1.x) && _almostEqual(a2.y, b1.y)) {
              var a1in = this.pointInPolygon(a1, B);
              var a3in = this.pointInPolygon(a3, B);
              if (a1in === true && a3in === false || a1in === false && a3in === true) {
                return true;
              } else {
                continue;
              }
            }
            var p = _lineIntersect(b1, b2, a1, a2);
            if (p !== null) {
              return true;
            }
          }
        }
        return false;
      },
      // placement algos as outlined in [1] http://www.cs.stir.ac.uk/~goc/papers/EffectiveHueristic2DAOR2013.pdf
      // returns a continuous polyline representing the normal-most edge of the given polygon
      // eg. a normal vector of [-1, 0] will return the left-most edge of the polygon
      // this is essentially algo 8 in [1], generalized for any vector direction
      polygonEdge: function(polygon, normal) {
        if (!polygon || polygon.length < 3) {
          return null;
        }
        normal = _normalizeVector(normal);
        var direction = {
          x: -normal.y,
          y: normal.x
        };
        var min = null;
        var max = null;
        var dotproduct = [];
        for (var i = 0; i < polygon.length; i++) {
          var dot = polygon[i].x * direction.x + polygon[i].y * direction.y;
          dotproduct.push(dot);
          if (min === null || dot < min) {
            min = dot;
          }
          if (max === null || dot > max) {
            max = dot;
          }
        }
        var indexmin = 0;
        var indexmax = 0;
        var normalmin = null;
        var normalmax = null;
        for (i = 0; i < polygon.length; i++) {
          if (_almostEqual(dotproduct[i], min)) {
            var dot = polygon[i].x * normal.x + polygon[i].y * normal.y;
            if (normalmin === null || dot > normalmin) {
              normalmin = dot;
              indexmin = i;
            }
          } else if (_almostEqual(dotproduct[i], max)) {
            var dot = polygon[i].x * normal.x + polygon[i].y * normal.y;
            if (normalmax === null || dot > normalmax) {
              normalmax = dot;
              indexmax = i;
            }
          }
        }
        var indexleft = indexmin - 1;
        var indexright = indexmin + 1;
        if (indexleft < 0) {
          indexleft = polygon.length - 1;
        }
        if (indexright >= polygon.length) {
          indexright = 0;
        }
        var minvertex = polygon[indexmin];
        var left = polygon[indexleft];
        var right = polygon[indexright];
        var leftvector = {
          x: left.x - minvertex.x,
          y: left.y - minvertex.y
        };
        var rightvector = {
          x: right.x - minvertex.x,
          y: right.y - minvertex.y
        };
        var dotleft = leftvector.x * direction.x + leftvector.y * direction.y;
        var dotright = rightvector.x * direction.x + rightvector.y * direction.y;
        var scandirection = -1;
        if (_almostEqual(dotleft, 0)) {
          scandirection = 1;
        } else if (_almostEqual(dotright, 0)) {
          scandirection = -1;
        } else {
          var normaldotleft;
          var normaldotright;
          if (_almostEqual(dotleft, dotright)) {
            normaldotleft = leftvector.x * normal.x + leftvector.y * normal.y;
            normaldotright = rightvector.x * normal.x + rightvector.y * normal.y;
          } else if (dotleft < dotright) {
            normaldotleft = leftvector.x * normal.x + leftvector.y * normal.y;
            normaldotright = (rightvector.x * normal.x + rightvector.y * normal.y) * (dotleft / dotright);
          } else {
            normaldotleft = leftvector.x * normal.x + leftvector.y * normal.y * (dotright / dotleft);
            normaldotright = rightvector.x * normal.x + rightvector.y * normal.y;
          }
          if (normaldotleft > normaldotright) {
            scandirection = -1;
          } else {
            scandirection = 1;
          }
        }
        var edge = [];
        var count = 0;
        i = indexmin;
        while (count < polygon.length) {
          if (i >= polygon.length) {
            i = 0;
          } else if (i < 0) {
            i = polygon.length - 1;
          }
          edge.push(polygon[i]);
          if (i == indexmax) {
            break;
          }
          i += scandirection;
          count++;
        }
        return edge;
      },
      // returns the normal distance from p to a line segment defined by s1 s2
      // this is basically algo 9 in [1], generalized for any vector direction
      // eg. normal of [-1, 0] returns the horizontal distance between the point and the line segment
      // sxinclusive: if true, include endpoints instead of excluding them
      pointLineDistance: function(p, s1, s2, normal, s1inclusive, s2inclusive) {
        normal = _normalizeVector(normal);
        var dir = {
          x: normal.y,
          y: -normal.x
        };
        var pdot = p.x * dir.x + p.y * dir.y;
        var s1dot = s1.x * dir.x + s1.y * dir.y;
        var s2dot = s2.x * dir.x + s2.y * dir.y;
        var pdotnorm = p.x * normal.x + p.y * normal.y;
        var s1dotnorm = s1.x * normal.x + s1.y * normal.y;
        var s2dotnorm = s2.x * normal.x + s2.y * normal.y;
        if (_almostEqual(pdot, s1dot) && _almostEqual(pdot, s2dot)) {
          if (_almostEqual(pdotnorm, s1dotnorm)) {
            return null;
          }
          if (_almostEqual(pdotnorm, s2dotnorm)) {
            return null;
          }
          if (pdotnorm > s1dotnorm && pdotnorm > s2dotnorm) {
            return Math.min(pdotnorm - s1dotnorm, pdotnorm - s2dotnorm);
          }
          if (pdotnorm < s1dotnorm && pdotnorm < s2dotnorm) {
            return -Math.min(s1dotnorm - pdotnorm, s2dotnorm - pdotnorm);
          }
          var diff1 = pdotnorm - s1dotnorm;
          var diff2 = pdotnorm - s2dotnorm;
          if (diff1 > 0) {
            return diff1;
          } else {
            return diff2;
          }
        } else if (_almostEqual(pdot, s1dot)) {
          if (s1inclusive) {
            return pdotnorm - s1dotnorm;
          } else {
            return null;
          }
        } else if (_almostEqual(pdot, s2dot)) {
          if (s2inclusive) {
            return pdotnorm - s2dotnorm;
          } else {
            return null;
          }
        } else if (pdot < s1dot && pdot < s2dot || pdot > s1dot && pdot > s2dot) {
          return null;
        }
        return pdotnorm - s1dotnorm + (s1dotnorm - s2dotnorm) * (s1dot - pdot) / (s1dot - s2dot);
      },
      pointDistance: function(p, s1, s2, normal, infinite) {
        normal = _normalizeVector(normal);
        var dir = {
          x: normal.y,
          y: -normal.x
        };
        var pdot = p.x * dir.x + p.y * dir.y;
        var s1dot = s1.x * dir.x + s1.y * dir.y;
        var s2dot = s2.x * dir.x + s2.y * dir.y;
        var pdotnorm = p.x * normal.x + p.y * normal.y;
        var s1dotnorm = s1.x * normal.x + s1.y * normal.y;
        var s2dotnorm = s2.x * normal.x + s2.y * normal.y;
        if (!infinite) {
          if ((pdot < s1dot || _almostEqual(pdot, s1dot)) && (pdot < s2dot || _almostEqual(pdot, s2dot)) || (pdot > s1dot || _almostEqual(pdot, s1dot)) && (pdot > s2dot || _almostEqual(pdot, s2dot))) {
            return null;
          }
          if (_almostEqual(pdot, s1dot) && _almostEqual(pdot, s2dot) && (pdotnorm > s1dotnorm && pdotnorm > s2dotnorm)) {
            return Math.min(pdotnorm - s1dotnorm, pdotnorm - s2dotnorm);
          }
          if (_almostEqual(pdot, s1dot) && _almostEqual(pdot, s2dot) && (pdotnorm < s1dotnorm && pdotnorm < s2dotnorm)) {
            return -Math.min(s1dotnorm - pdotnorm, s2dotnorm - pdotnorm);
          }
        }
        return -(pdotnorm - s1dotnorm + (s1dotnorm - s2dotnorm) * (s1dot - pdot) / (s1dot - s2dot));
      },
      segmentDistance: function(A, B, E, F, direction) {
        var normal = {
          x: direction.y,
          y: -direction.x
        };
        var reverse = {
          x: -direction.x,
          y: -direction.y
        };
        var dotA = A.x * normal.x + A.y * normal.y;
        var dotB = B.x * normal.x + B.y * normal.y;
        var dotE = E.x * normal.x + E.y * normal.y;
        var dotF = F.x * normal.x + F.y * normal.y;
        var crossA = A.x * direction.x + A.y * direction.y;
        var crossB = B.x * direction.x + B.y * direction.y;
        var crossE = E.x * direction.x + E.y * direction.y;
        var crossF = F.x * direction.x + F.y * direction.y;
        var crossABmin = Math.min(crossA, crossB);
        var crossABmax = Math.max(crossA, crossB);
        var crossEFmax = Math.max(crossE, crossF);
        var crossEFmin = Math.min(crossE, crossF);
        var ABmin = Math.min(dotA, dotB);
        var ABmax = Math.max(dotA, dotB);
        var EFmax = Math.max(dotE, dotF);
        var EFmin = Math.min(dotE, dotF);
        if (_almostEqual(ABmax, EFmin, TOL) || _almostEqual(ABmin, EFmax, TOL)) {
          return null;
        }
        if (ABmax < EFmin || ABmin > EFmax) {
          return null;
        }
        var overlap;
        if (ABmax > EFmax && ABmin < EFmin || EFmax > ABmax && EFmin < ABmin) {
          overlap = 1;
        } else {
          var minMax = Math.min(ABmax, EFmax);
          var maxMin = Math.max(ABmin, EFmin);
          var maxMax = Math.max(ABmax, EFmax);
          var minMin = Math.min(ABmin, EFmin);
          overlap = (minMax - maxMin) / (maxMax - minMin);
        }
        var crossABE = (E.y - A.y) * (B.x - A.x) - (E.x - A.x) * (B.y - A.y);
        var crossABF = (F.y - A.y) * (B.x - A.x) - (F.x - A.x) * (B.y - A.y);
        if (_almostEqual(crossABE, 0) && _almostEqual(crossABF, 0)) {
          var ABnorm = { x: B.y - A.y, y: A.x - B.x };
          var EFnorm = { x: F.y - E.y, y: E.x - F.x };
          var ABnormlength = Math.sqrt(ABnorm.x * ABnorm.x + ABnorm.y * ABnorm.y);
          ABnorm.x /= ABnormlength;
          ABnorm.y /= ABnormlength;
          var EFnormlength = Math.sqrt(EFnorm.x * EFnorm.x + EFnorm.y * EFnorm.y);
          EFnorm.x /= EFnormlength;
          EFnorm.y /= EFnormlength;
          if (Math.abs(ABnorm.y * EFnorm.x - ABnorm.x * EFnorm.y) < TOL && ABnorm.y * EFnorm.y + ABnorm.x * EFnorm.x < 0) {
            var normdot = ABnorm.y * direction.y + ABnorm.x * direction.x;
            if (_almostEqual(normdot, 0, TOL)) {
              return null;
            }
            if (normdot < 0) {
              return 0;
            }
          }
          return null;
        }
        var distances = [];
        if (_almostEqual(dotA, dotE)) {
          distances.push(crossA - crossE);
        } else if (_almostEqual(dotA, dotF)) {
          distances.push(crossA - crossF);
        } else if (dotA > EFmin && dotA < EFmax) {
          var d = this.pointDistance(A, E, F, reverse);
          if (d !== null && _almostEqual(d, 0)) {
            var dB = this.pointDistance(B, E, F, reverse, true);
            if (dB < 0 || _almostEqual(dB * overlap, 0)) {
              d = null;
            }
          }
          if (d !== null) {
            distances.push(d);
          }
        }
        if (_almostEqual(dotB, dotE)) {
          distances.push(crossB - crossE);
        } else if (_almostEqual(dotB, dotF)) {
          distances.push(crossB - crossF);
        } else if (dotB > EFmin && dotB < EFmax) {
          var d = this.pointDistance(B, E, F, reverse);
          if (d !== null && _almostEqual(d, 0)) {
            var dA = this.pointDistance(A, E, F, reverse, true);
            if (dA < 0 || _almostEqual(dA * overlap, 0)) {
              d = null;
            }
          }
          if (d !== null) {
            distances.push(d);
          }
        }
        if (dotE > ABmin && dotE < ABmax) {
          var d = this.pointDistance(E, A, B, direction);
          if (d !== null && _almostEqual(d, 0)) {
            var dF = this.pointDistance(F, A, B, direction, true);
            if (dF < 0 || _almostEqual(dF * overlap, 0)) {
              d = null;
            }
          }
          if (d !== null) {
            distances.push(d);
          }
        }
        if (dotF > ABmin && dotF < ABmax) {
          var d = this.pointDistance(F, A, B, direction);
          if (d !== null && _almostEqual(d, 0)) {
            var dE = this.pointDistance(E, A, B, direction, true);
            if (dE < 0 || _almostEqual(dE * overlap, 0)) {
              d = null;
            }
          }
          if (d !== null) {
            distances.push(d);
          }
        }
        if (distances.length == 0) {
          return null;
        }
        return Math.min.apply(Math, distances);
      },
      polygonSlideDistance: function(A, B, direction, ignoreNegative) {
        var A1, A2, B1, B2, Aoffsetx, Aoffsety, Boffsetx, Boffsety;
        Aoffsetx = A.offsetx || 0;
        Aoffsety = A.offsety || 0;
        Boffsetx = B.offsetx || 0;
        Boffsety = B.offsety || 0;
        A = A.slice(0);
        B = B.slice(0);
        if (A[0] != A[A.length - 1]) {
          A.push(A[0]);
        }
        if (B[0] != B[B.length - 1]) {
          B.push(B[0]);
        }
        var edgeA = A;
        var edgeB = B;
        var distance = null;
        var p, s1, s2, d;
        var dir = _normalizeVector(direction);
        var normal = {
          x: dir.y,
          y: -dir.x
        };
        var reverse = {
          x: -dir.x,
          y: -dir.y
        };
        for (var i = 0; i < edgeB.length - 1; i++) {
          var mind = null;
          for (var j = 0; j < edgeA.length - 1; j++) {
            A1 = { x: edgeA[j].x + Aoffsetx, y: edgeA[j].y + Aoffsety };
            A2 = { x: edgeA[j + 1].x + Aoffsetx, y: edgeA[j + 1].y + Aoffsety };
            B1 = { x: edgeB[i].x + Boffsetx, y: edgeB[i].y + Boffsety };
            B2 = { x: edgeB[i + 1].x + Boffsetx, y: edgeB[i + 1].y + Boffsety };
            if (_almostEqual(A1.x, A2.x) && _almostEqual(A1.y, A2.y) || _almostEqual(B1.x, B2.x) && _almostEqual(B1.y, B2.y)) {
              continue;
            }
            d = this.segmentDistance(A1, A2, B1, B2, dir);
            if (d !== null && (distance === null || d < distance)) {
              if (!ignoreNegative || d > 0 || _almostEqual(d, 0)) {
                distance = d;
              }
            }
          }
        }
        return distance;
      },
      // project each point of B onto A in the given direction, and return the 
      polygonProjectionDistance: function(A, B, direction) {
        var Boffsetx = B.offsetx || 0;
        var Boffsety = B.offsety || 0;
        var Aoffsetx = A.offsetx || 0;
        var Aoffsety = A.offsety || 0;
        A = A.slice(0);
        B = B.slice(0);
        if (A[0] != A[A.length - 1]) {
          A.push(A[0]);
        }
        if (B[0] != B[B.length - 1]) {
          B.push(B[0]);
        }
        var edgeA = A;
        var edgeB = B;
        var distance = null;
        var p, d, s1, s2;
        for (var i = 0; i < edgeB.length; i++) {
          var minprojection = null;
          var minp = null;
          for (var j = 0; j < edgeA.length - 1; j++) {
            p = { x: edgeB[i].x + Boffsetx, y: edgeB[i].y + Boffsety };
            s1 = { x: edgeA[j].x + Aoffsetx, y: edgeA[j].y + Aoffsety };
            s2 = { x: edgeA[j + 1].x + Aoffsetx, y: edgeA[j + 1].y + Aoffsety };
            if (Math.abs((s2.y - s1.y) * direction.x - (s2.x - s1.x) * direction.y) < TOL) {
              continue;
            }
            d = this.pointDistance(p, s1, s2, direction);
            if (d !== null && (minprojection === null || d < minprojection)) {
              minprojection = d;
              minp = p;
            }
          }
          if (minprojection !== null && (distance === null || minprojection > distance)) {
            distance = minprojection;
          }
        }
        return distance;
      },
      // searches for an arrangement of A and B such that they do not overlap
      // if an NFP is given, only search for startpoints that have not already been traversed in the given NFP
      searchStartPoint: function(A, B, inside, NFP) {
        A = A.slice(0);
        B = B.slice(0);
        if (A[0] != A[A.length - 1]) {
          A.push(A[0]);
        }
        if (B[0] != B[B.length - 1]) {
          B.push(B[0]);
        }
        for (var i = 0; i < A.length - 1; i++) {
          if (!A[i].marked) {
            A[i].marked = true;
            for (var j = 0; j < B.length; j++) {
              B.offsetx = A[i].x - B[j].x;
              B.offsety = A[i].y - B[j].y;
              var Binside = null;
              for (var k = 0; k < B.length; k++) {
                var inpoly = this.pointInPolygon({ x: B[k].x + B.offsetx, y: B[k].y + B.offsety }, A);
                if (inpoly !== null) {
                  Binside = inpoly;
                  break;
                }
              }
              if (Binside === null) {
                return null;
              }
              var startPoint = { x: B.offsetx, y: B.offsety };
              if ((Binside && inside || !Binside && !inside) && !this.intersect(A, B) && !inNfp(startPoint, NFP)) {
                return startPoint;
              }
              var vx = A[i + 1].x - A[i].x;
              var vy = A[i + 1].y - A[i].y;
              var d1 = this.polygonProjectionDistance(A, B, { x: vx, y: vy });
              var d2 = this.polygonProjectionDistance(B, A, { x: -vx, y: -vy });
              var d = null;
              if (d1 === null && d2 === null) {
              } else if (d1 === null) {
                d = d2;
              } else if (d2 === null) {
                d = d1;
              } else {
                d = Math.min(d1, d2);
              }
              if (d !== null && !_almostEqual(d, 0) && d > 0) {
              } else {
                continue;
              }
              var vd2 = vx * vx + vy * vy;
              if (d * d < vd2 && !_almostEqual(d * d, vd2)) {
                var vd = Math.sqrt(vx * vx + vy * vy);
                vx *= d / vd;
                vy *= d / vd;
              }
              B.offsetx += vx;
              B.offsety += vy;
              for (k = 0; k < B.length; k++) {
                var inpoly = this.pointInPolygon({ x: B[k].x + B.offsetx, y: B[k].y + B.offsety }, A);
                if (inpoly !== null) {
                  Binside = inpoly;
                  break;
                }
              }
              startPoint = { x: B.offsetx, y: B.offsety };
              if ((Binside && inside || !Binside && !inside) && !this.intersect(A, B) && !inNfp(startPoint, NFP)) {
                return startPoint;
              }
            }
          }
        }
        function inNfp(p, nfp) {
          if (!nfp || nfp.length == 0) {
            return false;
          }
          for (var i2 = 0; i2 < nfp.length; i2++) {
            for (var j2 = 0; j2 < nfp[i2].length; j2++) {
              if (_almostEqual(p.x, nfp[i2][j2].x) && _almostEqual(p.y, nfp[i2][j2].y)) {
                return true;
              }
            }
          }
          return false;
        }
        return null;
      },
      isRectangle: function(poly, tolerance) {
        var bb = this.getPolygonBounds(poly);
        tolerance = tolerance || TOL;
        for (var i = 0; i < poly.length; i++) {
          if (!_almostEqual(poly[i].x, bb.x) && !_almostEqual(poly[i].x, bb.x + bb.width)) {
            return false;
          }
          if (!_almostEqual(poly[i].y, bb.y) && !_almostEqual(poly[i].y, bb.y + bb.height)) {
            return false;
          }
        }
        return true;
      },
      // returns an interior NFP for the special case where A is a rectangle
      noFitPolygonRectangle: function(A, B) {
        var minAx = A[0].x;
        var minAy = A[0].y;
        var maxAx = A[0].x;
        var maxAy = A[0].y;
        for (var i = 1; i < A.length; i++) {
          if (A[i].x < minAx) {
            minAx = A[i].x;
          }
          if (A[i].y < minAy) {
            minAy = A[i].y;
          }
          if (A[i].x > maxAx) {
            maxAx = A[i].x;
          }
          if (A[i].y > maxAy) {
            maxAy = A[i].y;
          }
        }
        var minBx = B[0].x;
        var minBy = B[0].y;
        var maxBx = B[0].x;
        var maxBy = B[0].y;
        for (i = 1; i < B.length; i++) {
          if (B[i].x < minBx) {
            minBx = B[i].x;
          }
          if (B[i].y < minBy) {
            minBy = B[i].y;
          }
          if (B[i].x > maxBx) {
            maxBx = B[i].x;
          }
          if (B[i].y > maxBy) {
            maxBy = B[i].y;
          }
        }
        if (maxBx - minBx > maxAx - minAx) {
          return null;
        }
        if (maxBy - minBy > maxAy - minAy) {
          return null;
        }
        return [[
          { x: minAx - minBx + B[0].x, y: minAy - minBy + B[0].y },
          { x: maxAx - maxBx + B[0].x, y: minAy - minBy + B[0].y },
          { x: maxAx - maxBx + B[0].x, y: maxAy - maxBy + B[0].y },
          { x: minAx - minBx + B[0].x, y: maxAy - maxBy + B[0].y }
        ]];
      },
      // given a static polygon A and a movable polygon B, compute a no fit polygon by orbiting B about A
      // if the inside flag is set, B is orbited inside of A rather than outside
      // if the searchEdges flag is set, all edges of A are explored for NFPs - multiple 
      noFitPolygon: function(A, B, inside, searchEdges) {
        if (!A || A.length < 3 || !B || B.length < 3) {
          return null;
        }
        A.offsetx = 0;
        A.offsety = 0;
        var i, j;
        var minA = A[0].y;
        var minAindex = 0;
        var maxB = B[0].y;
        var maxBindex = 0;
        for (i = 1; i < A.length; i++) {
          A[i].marked = false;
          if (A[i].y < minA) {
            minA = A[i].y;
            minAindex = i;
          }
        }
        for (i = 1; i < B.length; i++) {
          B[i].marked = false;
          if (B[i].y > maxB) {
            maxB = B[i].y;
            maxBindex = i;
          }
        }
        if (!inside) {
          var startpoint = {
            x: A[minAindex].x - B[maxBindex].x,
            y: A[minAindex].y - B[maxBindex].y
          };
        } else {
          var startpoint = this.searchStartPoint(A, B, true);
        }
        var NFPlist = [];
        while (startpoint !== null) {
          B.offsetx = startpoint.x;
          B.offsety = startpoint.y;
          var touching;
          var prevvector = null;
          var NFP = [{
            x: B[0].x + B.offsetx,
            y: B[0].y + B.offsety
          }];
          var referencex = B[0].x + B.offsetx;
          var referencey = B[0].y + B.offsety;
          var startx = referencex;
          var starty = referencey;
          var counter = 0;
          while (counter < 10 * (A.length + B.length)) {
            touching = [];
            for (i = 0; i < A.length; i++) {
              var nexti = i == A.length - 1 ? 0 : i + 1;
              for (j = 0; j < B.length; j++) {
                var nextj = j == B.length - 1 ? 0 : j + 1;
                if (_almostEqual(A[i].x, B[j].x + B.offsetx) && _almostEqual(A[i].y, B[j].y + B.offsety)) {
                  touching.push({ type: 0, A: i, B: j });
                } else if (_onSegment(A[i], A[nexti], { x: B[j].x + B.offsetx, y: B[j].y + B.offsety })) {
                  touching.push({ type: 1, A: nexti, B: j });
                } else if (_onSegment({ x: B[j].x + B.offsetx, y: B[j].y + B.offsety }, { x: B[nextj].x + B.offsetx, y: B[nextj].y + B.offsety }, A[i])) {
                  touching.push({ type: 2, A: i, B: nextj });
                }
              }
            }
            var vectors = [];
            for (i = 0; i < touching.length; i++) {
              var vertexA = A[touching[i].A];
              vertexA.marked = true;
              var prevAindex = touching[i].A - 1;
              var nextAindex = touching[i].A + 1;
              prevAindex = prevAindex < 0 ? A.length - 1 : prevAindex;
              nextAindex = nextAindex >= A.length ? 0 : nextAindex;
              var prevA = A[prevAindex];
              var nextA = A[nextAindex];
              var vertexB = B[touching[i].B];
              var prevBindex = touching[i].B - 1;
              var nextBindex = touching[i].B + 1;
              prevBindex = prevBindex < 0 ? B.length - 1 : prevBindex;
              nextBindex = nextBindex >= B.length ? 0 : nextBindex;
              var prevB = B[prevBindex];
              var nextB = B[nextBindex];
              if (touching[i].type == 0) {
                var vA1 = {
                  x: prevA.x - vertexA.x,
                  y: prevA.y - vertexA.y,
                  start: vertexA,
                  end: prevA
                };
                var vA2 = {
                  x: nextA.x - vertexA.x,
                  y: nextA.y - vertexA.y,
                  start: vertexA,
                  end: nextA
                };
                var vB1 = {
                  x: vertexB.x - prevB.x,
                  y: vertexB.y - prevB.y,
                  start: prevB,
                  end: vertexB
                };
                var vB2 = {
                  x: vertexB.x - nextB.x,
                  y: vertexB.y - nextB.y,
                  start: nextB,
                  end: vertexB
                };
                vectors.push(vA1);
                vectors.push(vA2);
                vectors.push(vB1);
                vectors.push(vB2);
              } else if (touching[i].type == 1) {
                vectors.push({
                  x: vertexA.x - (vertexB.x + B.offsetx),
                  y: vertexA.y - (vertexB.y + B.offsety),
                  start: prevA,
                  end: vertexA
                });
                vectors.push({
                  x: prevA.x - (vertexB.x + B.offsetx),
                  y: prevA.y - (vertexB.y + B.offsety),
                  start: vertexA,
                  end: prevA
                });
              } else if (touching[i].type == 2) {
                vectors.push({
                  x: vertexA.x - (vertexB.x + B.offsetx),
                  y: vertexA.y - (vertexB.y + B.offsety),
                  start: prevB,
                  end: vertexB
                });
                vectors.push({
                  x: vertexA.x - (prevB.x + B.offsetx),
                  y: vertexA.y - (prevB.y + B.offsety),
                  start: vertexB,
                  end: prevB
                });
              }
            }
            var translate = null;
            var maxd = 0;
            for (i = 0; i < vectors.length; i++) {
              if (vectors[i].x == 0 && vectors[i].y == 0) {
                continue;
              }
              if (prevvector && vectors[i].y * prevvector.y + vectors[i].x * prevvector.x < 0) {
                var vectorlength = Math.sqrt(vectors[i].x * vectors[i].x + vectors[i].y * vectors[i].y);
                var unitv = { x: vectors[i].x / vectorlength, y: vectors[i].y / vectorlength };
                var prevlength = Math.sqrt(prevvector.x * prevvector.x + prevvector.y * prevvector.y);
                var prevunit = { x: prevvector.x / prevlength, y: prevvector.y / prevlength };
                if (Math.abs(unitv.y * prevunit.x - unitv.x * prevunit.y) < 1e-4) {
                  continue;
                }
              }
              var d = this.polygonSlideDistance(A, B, vectors[i], true);
              var vecd2 = vectors[i].x * vectors[i].x + vectors[i].y * vectors[i].y;
              if (d === null || d * d > vecd2) {
                var vecd = Math.sqrt(vectors[i].x * vectors[i].x + vectors[i].y * vectors[i].y);
                d = vecd;
              }
              if (d !== null && d > maxd) {
                maxd = d;
                translate = vectors[i];
              }
            }
            if (translate === null || _almostEqual(maxd, 0)) {
              NFP = null;
              break;
            }
            translate.start.marked = true;
            translate.end.marked = true;
            prevvector = translate;
            var vlength2 = translate.x * translate.x + translate.y * translate.y;
            if (maxd * maxd < vlength2 && !_almostEqual(maxd * maxd, vlength2)) {
              var scale = Math.sqrt(maxd * maxd / vlength2);
              translate.x *= scale;
              translate.y *= scale;
            }
            referencex += translate.x;
            referencey += translate.y;
            if (_almostEqual(referencex, startx) && _almostEqual(referencey, starty)) {
              break;
            }
            var looped = false;
            if (NFP.length > 0) {
              for (i = 0; i < NFP.length - 1; i++) {
                if (_almostEqual(referencex, NFP[i].x) && _almostEqual(referencey, NFP[i].y)) {
                  looped = true;
                }
              }
            }
            if (looped) {
              break;
            }
            NFP.push({
              x: referencex,
              y: referencey
            });
            B.offsetx += translate.x;
            B.offsety += translate.y;
            counter++;
          }
          if (NFP && NFP.length > 0) {
            NFPlist.push(NFP);
          }
          if (!searchEdges) {
            break;
          }
          startpoint = this.searchStartPoint(A, B, inside, NFPlist);
        }
        return NFPlist;
      },
      // given two polygons that touch at at least one point, but do not intersect. Return the outer perimeter of both polygons as a single continuous polygon
      // A and B must have the same winding direction
      polygonHull: function(A, B) {
        if (!A || A.length < 3 || !B || B.length < 3) {
          return null;
        }
        var i, j;
        var Aoffsetx = A.offsetx || 0;
        var Aoffsety = A.offsety || 0;
        var Boffsetx = B.offsetx || 0;
        var Boffsety = B.offsety || 0;
        var miny = A[0].y;
        var startPolygon = A;
        var startIndex = 0;
        for (i = 0; i < A.length; i++) {
          if (A[i].y + Aoffsety < miny) {
            miny = A[i].y + Aoffsety;
            startPolygon = A;
            startIndex = i;
          }
        }
        for (i = 0; i < B.length; i++) {
          if (B[i].y + Boffsety < miny) {
            miny = B[i].y + Boffsety;
            startPolygon = B;
            startIndex = i;
          }
        }
        if (startPolygon == B) {
          B = A;
          A = startPolygon;
          Aoffsetx = A.offsetx || 0;
          Aoffsety = A.offsety || 0;
          Boffsetx = B.offsetx || 0;
          Boffsety = B.offsety || 0;
        }
        A = A.slice(0);
        B = B.slice(0);
        var C = [];
        var current = startIndex;
        var intercept1 = null;
        var intercept2 = null;
        for (i = 0; i < A.length + 1; i++) {
          current = current == A.length ? 0 : current;
          var next = current == A.length - 1 ? 0 : current + 1;
          var touching = false;
          for (j = 0; j < B.length; j++) {
            var nextj = j == B.length - 1 ? 0 : j + 1;
            if (_almostEqual(A[current].x + Aoffsetx, B[j].x + Boffsetx) && _almostEqual(A[current].y + Aoffsety, B[j].y + Boffsety)) {
              C.push({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety });
              intercept1 = j;
              touching = true;
              break;
            } else if (_onSegment({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety }, { x: A[next].x + Aoffsetx, y: A[next].y + Aoffsety }, { x: B[j].x + Boffsetx, y: B[j].y + Boffsety })) {
              C.push({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety });
              C.push({ x: B[j].x + Boffsetx, y: B[j].y + Boffsety });
              intercept1 = j;
              touching = true;
              break;
            } else if (_onSegment({ x: B[j].x + Boffsetx, y: B[j].y + Boffsety }, { x: B[nextj].x + Boffsetx, y: B[nextj].y + Boffsety }, { x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety })) {
              C.push({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety });
              C.push({ x: B[nextj].x + Boffsetx, y: B[nextj].y + Boffsety });
              intercept1 = nextj;
              touching = true;
              break;
            }
          }
          if (touching) {
            break;
          }
          C.push({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety });
          current++;
        }
        current = startIndex - 1;
        for (i = 0; i < A.length + 1; i++) {
          current = current < 0 ? A.length - 1 : current;
          var next = current == 0 ? A.length - 1 : current - 1;
          var touching = false;
          for (j = 0; j < B.length; j++) {
            var nextj = j == B.length - 1 ? 0 : j + 1;
            if (_almostEqual(A[current].x + Aoffsetx, B[j].x + Boffsetx) && _almostEqual(A[current].y, B[j].y + Boffsety)) {
              C.unshift({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety });
              intercept2 = j;
              touching = true;
              break;
            } else if (_onSegment({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety }, { x: A[next].x + Aoffsetx, y: A[next].y + Aoffsety }, { x: B[j].x + Boffsetx, y: B[j].y + Boffsety })) {
              C.unshift({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety });
              C.unshift({ x: B[j].x + Boffsetx, y: B[j].y + Boffsety });
              intercept2 = j;
              touching = true;
              break;
            } else if (_onSegment({ x: B[j].x + Boffsetx, y: B[j].y + Boffsety }, { x: B[nextj].x + Boffsetx, y: B[nextj].y + Boffsety }, { x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety })) {
              C.unshift({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety });
              intercept2 = j;
              touching = true;
              break;
            }
          }
          if (touching) {
            break;
          }
          C.unshift({ x: A[current].x + Aoffsetx, y: A[current].y + Aoffsety });
          current--;
        }
        if (intercept1 === null || intercept2 === null) {
          return null;
        }
        current = intercept1 + 1;
        for (i = 0; i < B.length; i++) {
          current = current == B.length ? 0 : current;
          C.push({ x: B[current].x + Boffsetx, y: B[current].y + Boffsety });
          if (current == intercept2) {
            break;
          }
          current++;
        }
        for (i = 0; i < C.length; i++) {
          var next = i == C.length - 1 ? 0 : i + 1;
          if (_almostEqual(C[i].x, C[next].x) && _almostEqual(C[i].y, C[next].y)) {
            C.splice(i, 1);
            i--;
          }
        }
        return C;
      },
      rotatePolygon: function(polygon, angle) {
        var rotated = [];
        angle = angle * Math.PI / 180;
        for (var i = 0; i < polygon.length; i++) {
          var x = polygon[i].x;
          var y = polygon[i].y;
          var x1 = x * Math.cos(angle) - y * Math.sin(angle);
          var y1 = x * Math.sin(angle) + y * Math.cos(angle);
          rotated.push({ x: x1, y: y1 });
        }
        var bounds = GeometryUtil.getPolygonBounds(rotated);
        rotated.x = bounds.x;
        rotated.y = bounds.y;
        rotated.width = bounds.width;
        rotated.height = bounds.height;
        return rotated;
      }
    };
    var geometryutil_default = GeometryUtil;
    var ClipperLib = (function() {
      var module = { exports: {} };
      (function() {
        function k(a, b, c) {
          d.biginteger_used = 1;
          null != a && ("number" == typeof a && "undefined" == typeof b ? this.fromInt(a) : "number" == typeof a ? this.fromNumber(a, b, c) : null == b && "string" != typeof a ? this.fromString(a, 256) : this.fromString(a, b));
        }
        function q() {
          return new k(null);
        }
        function Q(a, b, c, e, d2, g) {
          for (; 0 <= --g; ) {
            var h = b * this[a++] + c[e] + d2;
            d2 = Math.floor(h / 67108864);
            c[e++] = h & 67108863;
          }
          return d2;
        }
        function R(a, b, c, e, d2, g) {
          var h = b & 32767;
          for (b >>= 15; 0 <= --g; ) {
            var l = this[a] & 32767, k2 = this[a++] >> 15, n = b * l + k2 * h, l = h * l + ((n & 32767) << 15) + c[e] + (d2 & 1073741823);
            d2 = (l >>> 30) + (n >>> 15) + b * k2 + (d2 >>> 30);
            c[e++] = l & 1073741823;
          }
          return d2;
        }
        function S(a, b, c, e, d2, g) {
          var h = b & 16383;
          for (b >>= 14; 0 <= --g; ) {
            var l = this[a] & 16383, k2 = this[a++] >> 14, n = b * l + k2 * h, l = h * l + ((n & 16383) << 14) + c[e] + d2;
            d2 = (l >> 28) + (n >> 14) + b * k2;
            c[e++] = l & 268435455;
          }
          return d2;
        }
        function L(a, b) {
          var c = B[a.charCodeAt(b)];
          return null == c ? -1 : c;
        }
        function v(a) {
          var b = q();
          b.fromInt(a);
          return b;
        }
        function C(a) {
          var b = 1, c;
          0 != (c = a >>> 16) && (a = c, b += 16);
          0 != (c = a >> 8) && (a = c, b += 8);
          0 != (c = a >> 4) && (a = c, b += 4);
          0 != (c = a >> 2) && (a = c, b += 2);
          0 != a >> 1 && (b += 1);
          return b;
        }
        function x(a) {
          this.m = a;
        }
        function y(a) {
          this.m = a;
          this.mp = a.invDigit();
          this.mpl = this.mp & 32767;
          this.mph = this.mp >> 15;
          this.um = (1 << a.DB - 15) - 1;
          this.mt2 = 2 * a.t;
        }
        function T(a, b) {
          return a & b;
        }
        function I(a, b) {
          return a | b;
        }
        function M(a, b) {
          return a ^ b;
        }
        function N(a, b) {
          return a & ~b;
        }
        function A() {
        }
        function O(a) {
          return a;
        }
        function w(a) {
          this.r2 = q();
          this.q3 = q();
          k.ONE.dlShiftTo(2 * a.t, this.r2);
          this.mu = this.r2.divide(a);
          this.m = a;
        }
        var d = {}, D = false;
        "undefined" !== typeof module && module.exports ? (module.exports = d, D = true) : "undefined" !== typeof document ? window.ClipperLib = d : self.ClipperLib = d;
        var r;
        if (D) p = "chrome", r = "Netscape";
        else {
          var p = navigator.userAgent.toString().toLowerCase();
          r = navigator.appName;
        }
        var E, J, F, G, H, P;
        E = -1 != p.indexOf("chrome") && -1 == p.indexOf("chromium") ? 1 : 0;
        D = -1 != p.indexOf("chromium") ? 1 : 0;
        J = -1 != p.indexOf("safari") && -1 == p.indexOf("chrome") && -1 == p.indexOf("chromium") ? 1 : 0;
        F = -1 != p.indexOf("firefox") ? 1 : 0;
        p.indexOf("firefox/17");
        p.indexOf("firefox/15");
        p.indexOf("firefox/3");
        G = -1 != p.indexOf("opera") ? 1 : 0;
        p.indexOf("msie 10");
        p.indexOf("msie 9");
        H = -1 != p.indexOf("msie 8") ? 1 : 0;
        P = -1 != p.indexOf("msie 7") ? 1 : 0;
        p = -1 != p.indexOf("msie ") ? 1 : 0;
        d.biginteger_used = null;
        "Microsoft Internet Explorer" == r ? (k.prototype.am = R, r = 30) : "Netscape" != r ? (k.prototype.am = Q, r = 26) : (k.prototype.am = S, r = 28);
        k.prototype.DB = r;
        k.prototype.DM = (1 << r) - 1;
        k.prototype.DV = 1 << r;
        k.prototype.FV = Math.pow(2, 52);
        k.prototype.F1 = 52 - r;
        k.prototype.F2 = 2 * r - 52;
        var B = [], u;
        r = 48;
        for (u = 0; 9 >= u; ++u) B[r++] = u;
        r = 97;
        for (u = 10; 36 > u; ++u) B[r++] = u;
        r = 65;
        for (u = 10; 36 > u; ++u) B[r++] = u;
        x.prototype.convert = function(a) {
          return 0 > a.s || 0 <= a.compareTo(this.m) ? a.mod(this.m) : a;
        };
        x.prototype.revert = function(a) {
          return a;
        };
        x.prototype.reduce = function(a) {
          a.divRemTo(this.m, null, a);
        };
        x.prototype.mulTo = function(a, b, c) {
          a.multiplyTo(b, c);
          this.reduce(c);
        };
        x.prototype.sqrTo = function(a, b) {
          a.squareTo(b);
          this.reduce(b);
        };
        y.prototype.convert = function(a) {
          var b = q();
          a.abs().dlShiftTo(this.m.t, b);
          b.divRemTo(this.m, null, b);
          0 > a.s && 0 < b.compareTo(k.ZERO) && this.m.subTo(b, b);
          return b;
        };
        y.prototype.revert = function(a) {
          var b = q();
          a.copyTo(b);
          this.reduce(b);
          return b;
        };
        y.prototype.reduce = function(a) {
          for (; a.t <= this.mt2; ) a[a.t++] = 0;
          for (var b = 0; b < this.m.t; ++b) {
            var c = a[b] & 32767, e = c * this.mpl + ((c * this.mph + (a[b] >> 15) * this.mpl & this.um) << 15) & a.DM, c = b + this.m.t;
            for (a[c] += this.m.am(0, e, a, b, 0, this.m.t); a[c] >= a.DV; ) a[c] -= a.DV, a[++c]++;
          }
          a.clamp();
          a.drShiftTo(this.m.t, a);
          0 <= a.compareTo(this.m) && a.subTo(this.m, a);
        };
        y.prototype.mulTo = function(a, b, c) {
          a.multiplyTo(b, c);
          this.reduce(c);
        };
        y.prototype.sqrTo = function(a, b) {
          a.squareTo(b);
          this.reduce(b);
        };
        k.prototype.copyTo = function(a) {
          for (var b = this.t - 1; 0 <= b; --b) a[b] = this[b];
          a.t = this.t;
          a.s = this.s;
        };
        k.prototype.fromInt = function(a) {
          this.t = 1;
          this.s = 0 > a ? -1 : 0;
          0 < a ? this[0] = a : -1 > a ? this[0] = a + this.DV : this.t = 0;
        };
        k.prototype.fromString = function(a, b) {
          var c;
          if (16 == b) c = 4;
          else if (8 == b) c = 3;
          else if (256 == b) c = 8;
          else if (2 == b) c = 1;
          else if (32 == b) c = 5;
          else if (4 == b) c = 2;
          else {
            this.fromRadix(a, b);
            return;
          }
          this.s = this.t = 0;
          for (var e = a.length, d2 = false, g = 0; 0 <= --e; ) {
            var h = 8 == c ? a[e] & 255 : L(a, e);
            0 > h ? "-" == a.charAt(e) && (d2 = true) : (d2 = false, 0 == g ? this[this.t++] = h : g + c > this.DB ? (this[this.t - 1] |= (h & (1 << this.DB - g) - 1) << g, this[this.t++] = h >> this.DB - g) : this[this.t - 1] |= h << g, g += c, g >= this.DB && (g -= this.DB));
          }
          8 == c && 0 != (a[0] & 128) && (this.s = -1, 0 < g && (this[this.t - 1] |= (1 << this.DB - g) - 1 << g));
          this.clamp();
          d2 && k.ZERO.subTo(this, this);
        };
        k.prototype.clamp = function() {
          for (var a = this.s & this.DM; 0 < this.t && this[this.t - 1] == a; ) --this.t;
        };
        k.prototype.dlShiftTo = function(a, b) {
          var c;
          for (c = this.t - 1; 0 <= c; --c) b[c + a] = this[c];
          for (c = a - 1; 0 <= c; --c) b[c] = 0;
          b.t = this.t + a;
          b.s = this.s;
        };
        k.prototype.drShiftTo = function(a, b) {
          for (var c = a; c < this.t; ++c) b[c - a] = this[c];
          b.t = Math.max(this.t - a, 0);
          b.s = this.s;
        };
        k.prototype.lShiftTo = function(a, b) {
          var c = a % this.DB, e = this.DB - c, d2 = (1 << e) - 1, g = Math.floor(a / this.DB), h = this.s << c & this.DM, l;
          for (l = this.t - 1; 0 <= l; --l) b[l + g + 1] = this[l] >> e | h, h = (this[l] & d2) << c;
          for (l = g - 1; 0 <= l; --l) b[l] = 0;
          b[g] = h;
          b.t = this.t + g + 1;
          b.s = this.s;
          b.clamp();
        };
        k.prototype.rShiftTo = function(a, b) {
          b.s = this.s;
          var c = Math.floor(a / this.DB);
          if (c >= this.t) b.t = 0;
          else {
            var e = a % this.DB, d2 = this.DB - e, g = (1 << e) - 1;
            b[0] = this[c] >> e;
            for (var h = c + 1; h < this.t; ++h) b[h - c - 1] |= (this[h] & g) << d2, b[h - c] = this[h] >> e;
            0 < e && (b[this.t - c - 1] |= (this.s & g) << d2);
            b.t = this.t - c;
            b.clamp();
          }
        };
        k.prototype.subTo = function(a, b) {
          for (var c = 0, e = 0, d2 = Math.min(a.t, this.t); c < d2; ) e += this[c] - a[c], b[c++] = e & this.DM, e >>= this.DB;
          if (a.t < this.t) {
            for (e -= a.s; c < this.t; ) e += this[c], b[c++] = e & this.DM, e >>= this.DB;
            e += this.s;
          } else {
            for (e += this.s; c < a.t; ) e -= a[c], b[c++] = e & this.DM, e >>= this.DB;
            e -= a.s;
          }
          b.s = 0 > e ? -1 : 0;
          -1 > e ? b[c++] = this.DV + e : 0 < e && (b[c++] = e);
          b.t = c;
          b.clamp();
        };
        k.prototype.multiplyTo = function(a, b) {
          var c = this.abs(), e = a.abs(), d2 = c.t;
          for (b.t = d2 + e.t; 0 <= --d2; ) b[d2] = 0;
          for (d2 = 0; d2 < e.t; ++d2) b[d2 + c.t] = c.am(0, e[d2], b, d2, 0, c.t);
          b.s = 0;
          b.clamp();
          this.s != a.s && k.ZERO.subTo(b, b);
        };
        k.prototype.squareTo = function(a) {
          for (var b = this.abs(), c = a.t = 2 * b.t; 0 <= --c; ) a[c] = 0;
          for (c = 0; c < b.t - 1; ++c) {
            var e = b.am(c, b[c], a, 2 * c, 0, 1);
            (a[c + b.t] += b.am(c + 1, 2 * b[c], a, 2 * c + 1, e, b.t - c - 1)) >= b.DV && (a[c + b.t] -= b.DV, a[c + b.t + 1] = 1);
          }
          0 < a.t && (a[a.t - 1] += b.am(c, b[c], a, 2 * c, 0, 1));
          a.s = 0;
          a.clamp();
        };
        k.prototype.divRemTo = function(a, b, c) {
          var e = a.abs();
          if (!(0 >= e.t)) {
            var d2 = this.abs();
            if (d2.t < e.t) null != b && b.fromInt(0), null != c && this.copyTo(c);
            else {
              null == c && (c = q());
              var g = q(), h = this.s;
              a = a.s;
              var l = this.DB - C(e[e.t - 1]);
              0 < l ? (e.lShiftTo(l, g), d2.lShiftTo(l, c)) : (e.copyTo(g), d2.copyTo(c));
              e = g.t;
              d2 = g[e - 1];
              if (0 != d2) {
                var z = d2 * (1 << this.F1) + (1 < e ? g[e - 2] >> this.F2 : 0), n = this.FV / z, z = (1 << this.F1) / z, U = 1 << this.F2, m2 = c.t, p2 = m2 - e, s = null == b ? q() : b;
                g.dlShiftTo(p2, s);
                0 <= c.compareTo(s) && (c[c.t++] = 1, c.subTo(s, c));
                k.ONE.dlShiftTo(e, s);
                for (s.subTo(g, g); g.t < e; ) g[g.t++] = 0;
                for (; 0 <= --p2; ) {
                  var r2 = c[--m2] == d2 ? this.DM : Math.floor(c[m2] * n + (c[m2 - 1] + U) * z);
                  if ((c[m2] += g.am(0, r2, c, p2, 0, e)) < r2) for (g.dlShiftTo(p2, s), c.subTo(s, c); c[m2] < --r2; ) c.subTo(s, c);
                }
                null != b && (c.drShiftTo(e, b), h != a && k.ZERO.subTo(b, b));
                c.t = e;
                c.clamp();
                0 < l && c.rShiftTo(l, c);
                0 > h && k.ZERO.subTo(c, c);
              }
            }
          }
        };
        k.prototype.invDigit = function() {
          if (1 > this.t) return 0;
          var a = this[0];
          if (0 == (a & 1)) return 0;
          var b = a & 3, b = b * (2 - (a & 15) * b) & 15, b = b * (2 - (a & 255) * b) & 255, b = b * (2 - ((a & 65535) * b & 65535)) & 65535, b = b * (2 - a * b % this.DV) % this.DV;
          return 0 < b ? this.DV - b : -b;
        };
        k.prototype.isEven = function() {
          return 0 == (0 < this.t ? this[0] & 1 : this.s);
        };
        k.prototype.exp = function(a, b) {
          if (4294967295 < a || 1 > a) return k.ONE;
          var c = q(), e = q(), d2 = b.convert(this), g = C(a) - 1;
          for (d2.copyTo(c); 0 <= --g; ) if (b.sqrTo(c, e), 0 < (a & 1 << g)) b.mulTo(e, d2, c);
          else var h = c, c = e, e = h;
          return b.revert(c);
        };
        k.prototype.toString = function(a) {
          if (0 > this.s) return "-" + this.negate().toString(a);
          if (16 == a) a = 4;
          else if (8 == a) a = 3;
          else if (2 == a) a = 1;
          else if (32 == a) a = 5;
          else if (4 == a) a = 2;
          else return this.toRadix(a);
          var b = (1 << a) - 1, c, e = false, d2 = "", g = this.t, h = this.DB - g * this.DB % a;
          if (0 < g--) for (h < this.DB && 0 < (c = this[g] >> h) && (e = true, d2 = "0123456789abcdefghijklmnopqrstuvwxyz".charAt(c)); 0 <= g; ) h < a ? (c = (this[g] & (1 << h) - 1) << a - h, c |= this[--g] >> (h += this.DB - a)) : (c = this[g] >> (h -= a) & b, 0 >= h && (h += this.DB, --g)), 0 < c && (e = true), e && (d2 += "0123456789abcdefghijklmnopqrstuvwxyz".charAt(c));
          return e ? d2 : "0";
        };
        k.prototype.negate = function() {
          var a = q();
          k.ZERO.subTo(this, a);
          return a;
        };
        k.prototype.abs = function() {
          return 0 > this.s ? this.negate() : this;
        };
        k.prototype.compareTo = function(a) {
          var b = this.s - a.s;
          if (0 != b) return b;
          var c = this.t, b = c - a.t;
          if (0 != b) return 0 > this.s ? -b : b;
          for (; 0 <= --c; ) if (0 != (b = this[c] - a[c])) return b;
          return 0;
        };
        k.prototype.bitLength = function() {
          return 0 >= this.t ? 0 : this.DB * (this.t - 1) + C(this[this.t - 1] ^ this.s & this.DM);
        };
        k.prototype.mod = function(a) {
          var b = q();
          this.abs().divRemTo(a, null, b);
          0 > this.s && 0 < b.compareTo(k.ZERO) && a.subTo(b, b);
          return b;
        };
        k.prototype.modPowInt = function(a, b) {
          var c;
          c = 256 > a || b.isEven() ? new x(b) : new y(b);
          return this.exp(a, c);
        };
        k.ZERO = v(0);
        k.ONE = v(1);
        A.prototype.convert = O;
        A.prototype.revert = O;
        A.prototype.mulTo = function(a, b, c) {
          a.multiplyTo(
            b,
            c
          );
        };
        A.prototype.sqrTo = function(a, b) {
          a.squareTo(b);
        };
        w.prototype.convert = function(a) {
          if (0 > a.s || a.t > 2 * this.m.t) return a.mod(this.m);
          if (0 > a.compareTo(this.m)) return a;
          var b = q();
          a.copyTo(b);
          this.reduce(b);
          return b;
        };
        w.prototype.revert = function(a) {
          return a;
        };
        w.prototype.reduce = function(a) {
          a.drShiftTo(this.m.t - 1, this.r2);
          a.t > this.m.t + 1 && (a.t = this.m.t + 1, a.clamp());
          this.mu.multiplyUpperTo(this.r2, this.m.t + 1, this.q3);
          for (this.m.multiplyLowerTo(this.q3, this.m.t + 1, this.r2); 0 > a.compareTo(this.r2); ) a.dAddOffset(
            1,
            this.m.t + 1
          );
          for (a.subTo(this.r2, a); 0 <= a.compareTo(this.m); ) a.subTo(this.m, a);
        };
        w.prototype.mulTo = function(a, b, c) {
          a.multiplyTo(b, c);
          this.reduce(c);
        };
        w.prototype.sqrTo = function(a, b) {
          a.squareTo(b);
          this.reduce(b);
        };
        var t = [
          2,
          3,
          5,
          7,
          11,
          13,
          17,
          19,
          23,
          29,
          31,
          37,
          41,
          43,
          47,
          53,
          59,
          61,
          67,
          71,
          73,
          79,
          83,
          89,
          97,
          101,
          103,
          107,
          109,
          113,
          127,
          131,
          137,
          139,
          149,
          151,
          157,
          163,
          167,
          173,
          179,
          181,
          191,
          193,
          197,
          199,
          211,
          223,
          227,
          229,
          233,
          239,
          241,
          251,
          257,
          263,
          269,
          271,
          277,
          281,
          283,
          293,
          307,
          311,
          313,
          317,
          331,
          337,
          347,
          349,
          353,
          359,
          367,
          373,
          379,
          383,
          389,
          397,
          401,
          409,
          419,
          421,
          431,
          433,
          439,
          443,
          449,
          457,
          461,
          463,
          467,
          479,
          487,
          491,
          499,
          503,
          509,
          521,
          523,
          541,
          547,
          557,
          563,
          569,
          571,
          577,
          587,
          593,
          599,
          601,
          607,
          613,
          617,
          619,
          631,
          641,
          643,
          647,
          653,
          659,
          661,
          673,
          677,
          683,
          691,
          701,
          709,
          719,
          727,
          733,
          739,
          743,
          751,
          757,
          761,
          769,
          773,
          787,
          797,
          809,
          811,
          821,
          823,
          827,
          829,
          839,
          853,
          857,
          859,
          863,
          877,
          881,
          883,
          887,
          907,
          911,
          919,
          929,
          937,
          941,
          947,
          953,
          967,
          971,
          977,
          983,
          991,
          997
        ], V = 67108864 / t[t.length - 1];
        k.prototype.chunkSize = function(a) {
          return Math.floor(Math.LN2 * this.DB / Math.log(a));
        };
        k.prototype.toRadix = function(a) {
          null == a && (a = 10);
          if (0 == this.signum() || 2 > a || 36 < a) return "0";
          var b = this.chunkSize(a), b = Math.pow(a, b), c = v(b), e = q(), d2 = q(), g = "";
          for (this.divRemTo(c, e, d2); 0 < e.signum(); ) g = (b + d2.intValue()).toString(a).substr(1) + g, e.divRemTo(c, e, d2);
          return d2.intValue().toString(a) + g;
        };
        k.prototype.fromRadix = function(a, b) {
          this.fromInt(0);
          null == b && (b = 10);
          for (var c = this.chunkSize(b), e = Math.pow(b, c), d2 = false, g = 0, h = 0, l = 0; l < a.length; ++l) {
            var z = L(a, l);
            0 > z ? "-" == a.charAt(l) && 0 == this.signum() && (d2 = true) : (h = b * h + z, ++g >= c && (this.dMultiply(e), this.dAddOffset(
              h,
              0
            ), h = g = 0));
          }
          0 < g && (this.dMultiply(Math.pow(b, g)), this.dAddOffset(h, 0));
          d2 && k.ZERO.subTo(this, this);
        };
        k.prototype.fromNumber = function(a, b, c) {
          if ("number" == typeof b) if (2 > a) this.fromInt(1);
          else for (this.fromNumber(a, c), this.testBit(a - 1) || this.bitwiseTo(k.ONE.shiftLeft(a - 1), I, this), this.isEven() && this.dAddOffset(1, 0); !this.isProbablePrime(b); ) this.dAddOffset(2, 0), this.bitLength() > a && this.subTo(k.ONE.shiftLeft(a - 1), this);
          else {
            c = [];
            var e = a & 7;
            c.length = (a >> 3) + 1;
            b.nextBytes(c);
            c[0] = 0 < e ? c[0] & (1 << e) - 1 : 0;
            this.fromString(
              c,
              256
            );
          }
        };
        k.prototype.bitwiseTo = function(a, b, c) {
          var e, d2, g = Math.min(a.t, this.t);
          for (e = 0; e < g; ++e) c[e] = b(this[e], a[e]);
          if (a.t < this.t) {
            d2 = a.s & this.DM;
            for (e = g; e < this.t; ++e) c[e] = b(this[e], d2);
            c.t = this.t;
          } else {
            d2 = this.s & this.DM;
            for (e = g; e < a.t; ++e) c[e] = b(d2, a[e]);
            c.t = a.t;
          }
          c.s = b(this.s, a.s);
          c.clamp();
        };
        k.prototype.changeBit = function(a, b) {
          var c = k.ONE.shiftLeft(a);
          this.bitwiseTo(c, b, c);
          return c;
        };
        k.prototype.addTo = function(a, b) {
          for (var c = 0, e = 0, d2 = Math.min(a.t, this.t); c < d2; ) e += this[c] + a[c], b[c++] = e & this.DM, e >>= this.DB;
          if (a.t < this.t) {
            for (e += a.s; c < this.t; ) e += this[c], b[c++] = e & this.DM, e >>= this.DB;
            e += this.s;
          } else {
            for (e += this.s; c < a.t; ) e += a[c], b[c++] = e & this.DM, e >>= this.DB;
            e += a.s;
          }
          b.s = 0 > e ? -1 : 0;
          0 < e ? b[c++] = e : -1 > e && (b[c++] = this.DV + e);
          b.t = c;
          b.clamp();
        };
        k.prototype.dMultiply = function(a) {
          this[this.t] = this.am(0, a - 1, this, 0, 0, this.t);
          ++this.t;
          this.clamp();
        };
        k.prototype.dAddOffset = function(a, b) {
          if (0 != a) {
            for (; this.t <= b; ) this[this.t++] = 0;
            for (this[b] += a; this[b] >= this.DV; ) this[b] -= this.DV, ++b >= this.t && (this[this.t++] = 0), ++this[b];
          }
        };
        k.prototype.multiplyLowerTo = function(a, b, c) {
          var e = Math.min(this.t + a.t, b);
          c.s = 0;
          for (c.t = e; 0 < e; ) c[--e] = 0;
          var d2;
          for (d2 = c.t - this.t; e < d2; ++e) c[e + this.t] = this.am(0, a[e], c, e, 0, this.t);
          for (d2 = Math.min(a.t, b); e < d2; ++e) this.am(0, a[e], c, e, 0, b - e);
          c.clamp();
        };
        k.prototype.multiplyUpperTo = function(a, b, c) {
          --b;
          var e = c.t = this.t + a.t - b;
          for (c.s = 0; 0 <= --e; ) c[e] = 0;
          for (e = Math.max(b - this.t, 0); e < a.t; ++e) c[this.t + e - b] = this.am(b - e, a[e], c, 0, 0, this.t + e - b);
          c.clamp();
          c.drShiftTo(1, c);
        };
        k.prototype.modInt = function(a) {
          if (0 >= a) return 0;
          var b = this.DV % a, c = 0 > this.s ? a - 1 : 0;
          if (0 < this.t) if (0 == b) c = this[0] % a;
          else for (var e = this.t - 1; 0 <= e; --e) c = (b * c + this[e]) % a;
          return c;
        };
        k.prototype.millerRabin = function(a) {
          var b = this.subtract(k.ONE), c = b.getLowestSetBit();
          if (0 >= c) return false;
          var e = b.shiftRight(c);
          a = a + 1 >> 1;
          a > t.length && (a = t.length);
          for (var d2 = q(), g = 0; g < a; ++g) {
            d2.fromInt(t[Math.floor(Math.random() * t.length)]);
            var h = d2.modPow(e, this);
            if (0 != h.compareTo(k.ONE) && 0 != h.compareTo(b)) {
              for (var l = 1; l++ < c && 0 != h.compareTo(b); ) if (h = h.modPowInt(2, this), 0 == h.compareTo(k.ONE)) return false;
              if (0 != h.compareTo(b)) return false;
            }
          }
          return true;
        };
        k.prototype.clone = function() {
          var a = q();
          this.copyTo(a);
          return a;
        };
        k.prototype.intValue = function() {
          if (0 > this.s) {
            if (1 == this.t) return this[0] - this.DV;
            if (0 == this.t) return -1;
          } else {
            if (1 == this.t) return this[0];
            if (0 == this.t) return 0;
          }
          return (this[1] & (1 << 32 - this.DB) - 1) << this.DB | this[0];
        };
        k.prototype.byteValue = function() {
          return 0 == this.t ? this.s : this[0] << 24 >> 24;
        };
        k.prototype.shortValue = function() {
          return 0 == this.t ? this.s : this[0] << 16 >> 16;
        };
        k.prototype.signum = function() {
          return 0 > this.s ? -1 : 0 >= this.t || 1 == this.t && 0 >= this[0] ? 0 : 1;
        };
        k.prototype.toByteArray = function() {
          var a = this.t, b = [];
          b[0] = this.s;
          var c = this.DB - a * this.DB % 8, e, d2 = 0;
          if (0 < a--) {
            for (c < this.DB && (e = this[a] >> c) != (this.s & this.DM) >> c && (b[d2++] = e | this.s << this.DB - c); 0 <= a; ) if (8 > c ? (e = (this[a] & (1 << c) - 1) << 8 - c, e |= this[--a] >> (c += this.DB - 8)) : (e = this[a] >> (c -= 8) & 255, 0 >= c && (c += this.DB, --a)), 0 != (e & 128) && (e |= -256), 0 == d2 && (this.s & 128) != (e & 128) && ++d2, 0 < d2 || e != this.s) b[d2++] = e;
          }
          return b;
        };
        k.prototype.equals = function(a) {
          return 0 == this.compareTo(a);
        };
        k.prototype.min = function(a) {
          return 0 > this.compareTo(a) ? this : a;
        };
        k.prototype.max = function(a) {
          return 0 < this.compareTo(a) ? this : a;
        };
        k.prototype.and = function(a) {
          var b = q();
          this.bitwiseTo(a, T, b);
          return b;
        };
        k.prototype.or = function(a) {
          var b = q();
          this.bitwiseTo(a, I, b);
          return b;
        };
        k.prototype.xor = function(a) {
          var b = q();
          this.bitwiseTo(a, M, b);
          return b;
        };
        k.prototype.andNot = function(a) {
          var b = q();
          this.bitwiseTo(a, N, b);
          return b;
        };
        k.prototype.not = function() {
          for (var a = q(), b = 0; b < this.t; ++b) a[b] = this.DM & ~this[b];
          a.t = this.t;
          a.s = ~this.s;
          return a;
        };
        k.prototype.shiftLeft = function(a) {
          var b = q();
          0 > a ? this.rShiftTo(-a, b) : this.lShiftTo(a, b);
          return b;
        };
        k.prototype.shiftRight = function(a) {
          var b = q();
          0 > a ? this.lShiftTo(-a, b) : this.rShiftTo(a, b);
          return b;
        };
        k.prototype.getLowestSetBit = function() {
          for (var a = 0; a < this.t; ++a) if (0 != this[a]) {
            var b = a * this.DB;
            a = this[a];
            if (0 == a) a = -1;
            else {
              var c = 0;
              0 == (a & 65535) && (a >>= 16, c += 16);
              0 == (a & 255) && (a >>= 8, c += 8);
              0 == (a & 15) && (a >>= 4, c += 4);
              0 == (a & 3) && (a >>= 2, c += 2);
              0 == (a & 1) && ++c;
              a = c;
            }
            return b + a;
          }
          return 0 > this.s ? this.t * this.DB : -1;
        };
        k.prototype.bitCount = function() {
          for (var a = 0, b = this.s & this.DM, c = 0; c < this.t; ++c) {
            for (var e = this[c] ^ b, d2 = 0; 0 != e; ) e &= e - 1, ++d2;
            a += d2;
          }
          return a;
        };
        k.prototype.testBit = function(a) {
          var b = Math.floor(a / this.DB);
          return b >= this.t ? 0 != this.s : 0 != (this[b] & 1 << a % this.DB);
        };
        k.prototype.setBit = function(a) {
          return this.changeBit(a, I);
        };
        k.prototype.clearBit = function(a) {
          return this.changeBit(a, N);
        };
        k.prototype.flipBit = function(a) {
          return this.changeBit(a, M);
        };
        k.prototype.add = function(a) {
          var b = q();
          this.addTo(a, b);
          return b;
        };
        k.prototype.subtract = function(a) {
          var b = q();
          this.subTo(a, b);
          return b;
        };
        k.prototype.multiply = function(a) {
          var b = q();
          this.multiplyTo(a, b);
          return b;
        };
        k.prototype.divide = function(a) {
          var b = q();
          this.divRemTo(a, b, null);
          return b;
        };
        k.prototype.remainder = function(a) {
          var b = q();
          this.divRemTo(a, null, b);
          return b;
        };
        k.prototype.divideAndRemainder = function(a) {
          var b = q(), c = q();
          this.divRemTo(a, b, c);
          return [b, c];
        };
        k.prototype.modPow = function(a, b) {
          var c = a.bitLength(), e, d2 = v(1), g;
          if (0 >= c) return d2;
          e = 18 > c ? 1 : 48 > c ? 3 : 144 > c ? 4 : 768 > c ? 5 : 6;
          g = 8 > c ? new x(b) : b.isEven() ? new w(b) : new y(b);
          var h = [], l = 3, k2 = e - 1, n = (1 << e) - 1;
          h[1] = g.convert(this);
          if (1 < e) for (c = q(), g.sqrTo(h[1], c); l <= n; ) h[l] = q(), g.mulTo(c, h[l - 2], h[l]), l += 2;
          for (var m2 = a.t - 1, p2, r2 = true, s = q(), c = C(a[m2]) - 1; 0 <= m2; ) {
            c >= k2 ? p2 = a[m2] >> c - k2 & n : (p2 = (a[m2] & (1 << c + 1) - 1) << k2 - c, 0 < m2 && (p2 |= a[m2 - 1] >> this.DB + c - k2));
            for (l = e; 0 == (p2 & 1); ) p2 >>= 1, --l;
            0 > (c -= l) && (c += this.DB, --m2);
            if (r2) h[p2].copyTo(d2), r2 = false;
            else {
              for (; 1 < l; ) g.sqrTo(d2, s), g.sqrTo(s, d2), l -= 2;
              0 < l ? g.sqrTo(d2, s) : (l = d2, d2 = s, s = l);
              g.mulTo(s, h[p2], d2);
            }
            for (; 0 <= m2 && 0 == (a[m2] & 1 << c); ) g.sqrTo(d2, s), l = d2, d2 = s, s = l, 0 > --c && (c = this.DB - 1, --m2);
          }
          return g.revert(d2);
        };
        k.prototype.modInverse = function(a) {
          var b = a.isEven();
          if (this.isEven() && b || 0 == a.signum()) return k.ZERO;
          for (var c = a.clone(), e = this.clone(), d2 = v(1), g = v(0), h = v(0), l = v(1); 0 != c.signum(); ) {
            for (; c.isEven(); ) c.rShiftTo(1, c), b ? (d2.isEven() && g.isEven() || (d2.addTo(this, d2), g.subTo(a, g)), d2.rShiftTo(1, d2)) : g.isEven() || g.subTo(a, g), g.rShiftTo(1, g);
            for (; e.isEven(); ) e.rShiftTo(1, e), b ? (h.isEven() && l.isEven() || (h.addTo(this, h), l.subTo(a, l)), h.rShiftTo(1, h)) : l.isEven() || l.subTo(a, l), l.rShiftTo(1, l);
            0 <= c.compareTo(e) ? (c.subTo(e, c), b && d2.subTo(h, d2), g.subTo(l, g)) : (e.subTo(c, e), b && h.subTo(d2, h), l.subTo(g, l));
          }
          if (0 != e.compareTo(k.ONE)) return k.ZERO;
          if (0 <= l.compareTo(a)) return l.subtract(a);
          if (0 > l.signum()) l.addTo(a, l);
          else return l;
          return 0 > l.signum() ? l.add(a) : l;
        };
        k.prototype.pow = function(a) {
          return this.exp(a, new A());
        };
        k.prototype.gcd = function(a) {
          var b = 0 > this.s ? this.negate() : this.clone();
          a = 0 > a.s ? a.negate() : a.clone();
          if (0 > b.compareTo(a)) {
            var c = b, b = a;
            a = c;
          }
          var c = b.getLowestSetBit(), e = a.getLowestSetBit();
          if (0 > e) return b;
          c < e && (e = c);
          0 < e && (b.rShiftTo(e, b), a.rShiftTo(e, a));
          for (; 0 < b.signum(); ) 0 < (c = b.getLowestSetBit()) && b.rShiftTo(c, b), 0 < (c = a.getLowestSetBit()) && a.rShiftTo(c, a), 0 <= b.compareTo(a) ? (b.subTo(a, b), b.rShiftTo(1, b)) : (a.subTo(b, a), a.rShiftTo(1, a));
          0 < e && a.lShiftTo(e, a);
          return a;
        };
        k.prototype.isProbablePrime = function(a) {
          var b, c = this.abs();
          if (1 == c.t && c[0] <= t[t.length - 1]) {
            for (b = 0; b < t.length; ++b) if (c[0] == t[b]) return true;
            return false;
          }
          if (c.isEven()) return false;
          for (b = 1; b < t.length; ) {
            for (var e = t[b], d2 = b + 1; d2 < t.length && e < V; ) e *= t[d2++];
            for (e = c.modInt(e); b < d2; ) if (0 == e % t[b++]) return false;
          }
          return c.millerRabin(a);
        };
        k.prototype.square = function() {
          var a = q();
          this.squareTo(a);
          return a;
        };
        var m = k;
        m.prototype.IsNegative = function() {
          return -1 == this.compareTo(m.ZERO) ? true : false;
        };
        m.op_Equality = function(a, b) {
          return 0 == a.compareTo(b) ? true : false;
        };
        m.op_Inequality = function(a, b) {
          return 0 != a.compareTo(b) ? true : false;
        };
        m.op_GreaterThan = function(a, b) {
          return 0 < a.compareTo(b) ? true : false;
        };
        m.op_LessThan = function(a, b) {
          return 0 > a.compareTo(b) ? true : false;
        };
        m.op_Addition = function(a, b) {
          return new m(a).add(new m(b));
        };
        m.op_Subtraction = function(a, b) {
          return new m(a).subtract(new m(b));
        };
        m.Int128Mul = function(a, b) {
          return new m(a).multiply(new m(b));
        };
        m.op_Division = function(a, b) {
          return a.divide(b);
        };
        m.prototype.ToDouble = function() {
          return parseFloat(this.toString());
        };
        if ("undefined" == typeof K) var K = function(a, b) {
          var c;
          if ("undefined" == typeof Object.getOwnPropertyNames) for (c in b.prototype) {
            if ("undefined" == typeof a.prototype[c] || a.prototype[c] == Object.prototype[c]) a.prototype[c] = b.prototype[c];
          }
          else for (var e = Object.getOwnPropertyNames(b.prototype), d2 = 0; d2 < e.length; d2++) "undefined" == typeof Object.getOwnPropertyDescriptor(a.prototype, e[d2]) && Object.defineProperty(a.prototype, e[d2], Object.getOwnPropertyDescriptor(b.prototype, e[d2]));
          for (c in b) "undefined" == typeof a[c] && (a[c] = b[c]);
          a.$baseCtor = b;
        };
        d.Path = function() {
          return [];
        };
        d.Paths = function() {
          return [];
        };
        d.DoublePoint = function() {
          var a = arguments;
          this.Y = this.X = 0;
          1 == a.length ? (this.X = a[0].X, this.Y = a[0].Y) : 2 == a.length && (this.X = a[0], this.Y = a[1]);
        };
        d.DoublePoint0 = function() {
          this.Y = this.X = 0;
        };
        d.DoublePoint1 = function(a) {
          this.X = a.X;
          this.Y = a.Y;
        };
        d.DoublePoint2 = function(a, b) {
          this.X = a;
          this.Y = b;
        };
        d.PolyNode = function() {
          this.m_Parent = null;
          this.m_polygon = new d.Path();
          this.m_endtype = this.m_jointype = this.m_Index = 0;
          this.m_Childs = [];
          this.IsOpen = false;
        };
        d.PolyNode.prototype.IsHoleNode = function() {
          for (var a = true, b = this.m_Parent; null !== b; ) a = !a, b = b.m_Parent;
          return a;
        };
        d.PolyNode.prototype.ChildCount = function() {
          return this.m_Childs.length;
        };
        d.PolyNode.prototype.Contour = function() {
          return this.m_polygon;
        };
        d.PolyNode.prototype.AddChild = function(a) {
          var b = this.m_Childs.length;
          this.m_Childs.push(a);
          a.m_Parent = this;
          a.m_Index = b;
        };
        d.PolyNode.prototype.GetNext = function() {
          return 0 < this.m_Childs.length ? this.m_Childs[0] : this.GetNextSiblingUp();
        };
        d.PolyNode.prototype.GetNextSiblingUp = function() {
          return null === this.m_Parent ? null : this.m_Index == this.m_Parent.m_Childs.length - 1 ? this.m_Parent.GetNextSiblingUp() : this.m_Parent.m_Childs[this.m_Index + 1];
        };
        d.PolyNode.prototype.Childs = function() {
          return this.m_Childs;
        };
        d.PolyNode.prototype.Parent = function() {
          return this.m_Parent;
        };
        d.PolyNode.prototype.IsHole = function() {
          return this.IsHoleNode();
        };
        d.PolyTree = function() {
          this.m_AllPolys = [];
          d.PolyNode.call(this);
        };
        d.PolyTree.prototype.Clear = function() {
          for (var a = 0, b = this.m_AllPolys.length; a < b; a++) this.m_AllPolys[a] = null;
          this.m_AllPolys.length = 0;
          this.m_Childs.length = 0;
        };
        d.PolyTree.prototype.GetFirst = function() {
          return 0 < this.m_Childs.length ? this.m_Childs[0] : null;
        };
        d.PolyTree.prototype.Total = function() {
          return this.m_AllPolys.length;
        };
        K(d.PolyTree, d.PolyNode);
        d.Math_Abs_Int64 = d.Math_Abs_Int32 = d.Math_Abs_Double = function(a) {
          return Math.abs(a);
        };
        d.Math_Max_Int32_Int32 = function(a, b) {
          return Math.max(a, b);
        };
        d.Cast_Int32 = p || G || J ? function(a) {
          return a | 0;
        } : function(a) {
          return ~~a;
        };
        d.Cast_Int64 = E ? function(a) {
          return -2147483648 > a || 2147483647 < a ? 0 > a ? Math.ceil(a) : Math.floor(a) : ~~a;
        } : F && "function" == typeof Number.toInteger ? function(a) {
          return Number.toInteger(a);
        } : P || H ? function(a) {
          return parseInt(a, 10);
        } : p ? function(a) {
          return -2147483648 > a || 2147483647 < a ? 0 > a ? Math.ceil(a) : Math.floor(a) : a | 0;
        } : function(a) {
          return 0 > a ? Math.ceil(a) : Math.floor(a);
        };
        d.Clear = function(a) {
          a.length = 0;
        };
        d.PI = 3.141592653589793;
        d.PI2 = 6.283185307179586;
        d.IntPoint = function() {
          var a;
          a = arguments;
          var b = a.length;
          this.Y = this.X = 0;
          2 == b ? (this.X = a[0], this.Y = a[1]) : 1 == b ? a[0] instanceof d.DoublePoint ? (a = a[0], this.X = d.Clipper.Round(a.X), this.Y = d.Clipper.Round(a.Y)) : (a = a[0], this.X = a.X, this.Y = a.Y) : this.Y = this.X = 0;
        };
        d.IntPoint.op_Equality = function(a, b) {
          return a.X == b.X && a.Y == b.Y;
        };
        d.IntPoint.op_Inequality = function(a, b) {
          return a.X != b.X || a.Y != b.Y;
        };
        d.IntPoint0 = function() {
          this.Y = this.X = 0;
        };
        d.IntPoint1 = function(a) {
          this.X = a.X;
          this.Y = a.Y;
        };
        d.IntPoint1dp = function(a) {
          this.X = d.Clipper.Round(a.X);
          this.Y = d.Clipper.Round(a.Y);
        };
        d.IntPoint2 = function(a, b) {
          this.X = a;
          this.Y = b;
        };
        d.IntRect = function() {
          var a = arguments, b = a.length;
          4 == b ? (this.left = a[0], this.top = a[1], this.right = a[2], this.bottom = a[3]) : 1 == b ? (this.left = ir.left, this.top = ir.top, this.right = ir.right, this.bottom = ir.bottom) : this.bottom = this.right = this.top = this.left = 0;
        };
        d.IntRect0 = function() {
          this.bottom = this.right = this.top = this.left = 0;
        };
        d.IntRect1 = function(a) {
          this.left = a.left;
          this.top = a.top;
          this.right = a.right;
          this.bottom = a.bottom;
        };
        d.IntRect4 = function(a, b, c, e) {
          this.left = a;
          this.top = b;
          this.right = c;
          this.bottom = e;
        };
        d.ClipType = { ctIntersection: 0, ctUnion: 1, ctDifference: 2, ctXor: 3 };
        d.PolyType = { ptSubject: 0, ptClip: 1 };
        d.PolyFillType = { pftEvenOdd: 0, pftNonZero: 1, pftPositive: 2, pftNegative: 3 };
        d.JoinType = { jtSquare: 0, jtRound: 1, jtMiter: 2 };
        d.EndType = { etOpenSquare: 0, etOpenRound: 1, etOpenButt: 2, etClosedLine: 3, etClosedPolygon: 4 };
        d.EdgeSide = { esLeft: 0, esRight: 1 };
        d.Direction = { dRightToLeft: 0, dLeftToRight: 1 };
        d.TEdge = function() {
          this.Bot = new d.IntPoint();
          this.Curr = new d.IntPoint();
          this.Top = new d.IntPoint();
          this.Delta = new d.IntPoint();
          this.Dx = 0;
          this.PolyTyp = d.PolyType.ptSubject;
          this.Side = d.EdgeSide.esLeft;
          this.OutIdx = this.WindCnt2 = this.WindCnt = this.WindDelta = 0;
          this.PrevInSEL = this.NextInSEL = this.PrevInAEL = this.NextInAEL = this.NextInLML = this.Prev = this.Next = null;
        };
        d.IntersectNode = function() {
          this.Edge2 = this.Edge1 = null;
          this.Pt = new d.IntPoint();
        };
        d.MyIntersectNodeSort = function() {
        };
        d.MyIntersectNodeSort.Compare = function(a, b) {
          return b.Pt.Y - a.Pt.Y;
        };
        d.LocalMinima = function() {
          this.Y = 0;
          this.Next = this.RightBound = this.LeftBound = null;
        };
        d.Scanbeam = function() {
          this.Y = 0;
          this.Next = null;
        };
        d.OutRec = function() {
          this.Idx = 0;
          this.IsOpen = this.IsHole = false;
          this.PolyNode = this.BottomPt = this.Pts = this.FirstLeft = null;
        };
        d.OutPt = function() {
          this.Idx = 0;
          this.Pt = new d.IntPoint();
          this.Prev = this.Next = null;
        };
        d.Join = function() {
          this.OutPt2 = this.OutPt1 = null;
          this.OffPt = new d.IntPoint();
        };
        d.ClipperBase = function() {
          this.m_CurrentLM = this.m_MinimaList = null;
          this.m_edges = [];
          this.PreserveCollinear = this.m_HasOpenPaths = this.m_UseFullRange = false;
          this.m_CurrentLM = this.m_MinimaList = null;
          this.m_HasOpenPaths = this.m_UseFullRange = false;
        };
        d.ClipperBase.horizontal = -9007199254740992;
        d.ClipperBase.Skip = -2;
        d.ClipperBase.Unassigned = -1;
        d.ClipperBase.tolerance = 1e-20;
        d.ClipperBase.loRange = 47453132;
        d.ClipperBase.hiRange = 4503599627370495;
        d.ClipperBase.near_zero = function(a) {
          return a > -d.ClipperBase.tolerance && a < d.ClipperBase.tolerance;
        };
        d.ClipperBase.IsHorizontal = function(a) {
          return 0 === a.Delta.Y;
        };
        d.ClipperBase.prototype.PointIsVertex = function(a, b) {
          var c = b;
          do {
            if (d.IntPoint.op_Equality(c.Pt, a)) return true;
            c = c.Next;
          } while (c != b);
          return false;
        };
        d.ClipperBase.prototype.PointOnLineSegment = function(a, b, c, e) {
          return e ? a.X == b.X && a.Y == b.Y || a.X == c.X && a.Y == c.Y || a.X > b.X == a.X < c.X && a.Y > b.Y == a.Y < c.Y && m.op_Equality(m.Int128Mul(a.X - b.X, c.Y - b.Y), m.Int128Mul(c.X - b.X, a.Y - b.Y)) : a.X == b.X && a.Y == b.Y || a.X == c.X && a.Y == c.Y || a.X > b.X == a.X < c.X && a.Y > b.Y == a.Y < c.Y && (a.X - b.X) * (c.Y - b.Y) == (c.X - b.X) * (a.Y - b.Y);
        };
        d.ClipperBase.prototype.PointOnPolygon = function(a, b, c) {
          for (var e = b; ; ) {
            if (this.PointOnLineSegment(a, e.Pt, e.Next.Pt, c)) return true;
            e = e.Next;
            if (e == b) break;
          }
          return false;
        };
        d.ClipperBase.prototype.SlopesEqual = d.ClipperBase.SlopesEqual = function() {
          var a = arguments, b = a.length, c, e, f;
          if (3 == b) return b = a[0], c = a[1], (a = a[2]) ? m.op_Equality(m.Int128Mul(b.Delta.Y, c.Delta.X), m.Int128Mul(b.Delta.X, c.Delta.Y)) : d.Cast_Int64(b.Delta.Y * c.Delta.X) == d.Cast_Int64(b.Delta.X * c.Delta.Y);
          if (4 == b) return b = a[0], c = a[1], e = a[2], (a = a[3]) ? m.op_Equality(
            m.Int128Mul(b.Y - c.Y, c.X - e.X),
            m.Int128Mul(b.X - c.X, c.Y - e.Y)
          ) : 0 === d.Cast_Int64((b.Y - c.Y) * (c.X - e.X)) - d.Cast_Int64((b.X - c.X) * (c.Y - e.Y));
          b = a[0];
          c = a[1];
          e = a[2];
          f = a[3];
          return (a = a[4]) ? m.op_Equality(m.Int128Mul(b.Y - c.Y, e.X - f.X), m.Int128Mul(b.X - c.X, e.Y - f.Y)) : 0 === d.Cast_Int64((b.Y - c.Y) * (e.X - f.X)) - d.Cast_Int64((b.X - c.X) * (e.Y - f.Y));
        };
        d.ClipperBase.SlopesEqual3 = function(a, b, c) {
          return c ? m.op_Equality(m.Int128Mul(a.Delta.Y, b.Delta.X), m.Int128Mul(a.Delta.X, b.Delta.Y)) : d.Cast_Int64(a.Delta.Y * b.Delta.X) == d.Cast_Int64(a.Delta.X * b.Delta.Y);
        };
        d.ClipperBase.SlopesEqual4 = function(a, b, c, e) {
          return e ? m.op_Equality(m.Int128Mul(a.Y - b.Y, b.X - c.X), m.Int128Mul(a.X - b.X, b.Y - c.Y)) : 0 === d.Cast_Int64((a.Y - b.Y) * (b.X - c.X)) - d.Cast_Int64((a.X - b.X) * (b.Y - c.Y));
        };
        d.ClipperBase.SlopesEqual5 = function(a, b, c, e, f) {
          return f ? m.op_Equality(m.Int128Mul(a.Y - b.Y, c.X - e.X), m.Int128Mul(a.X - b.X, c.Y - e.Y)) : 0 === d.Cast_Int64((a.Y - b.Y) * (c.X - e.X)) - d.Cast_Int64((a.X - b.X) * (c.Y - e.Y));
        };
        d.ClipperBase.prototype.Clear = function() {
          this.DisposeLocalMinimaList();
          for (var a = 0, b = this.m_edges.length; a < b; ++a) {
            for (var c = 0, e = this.m_edges[a].length; c < e; ++c) this.m_edges[a][c] = null;
            d.Clear(this.m_edges[a]);
          }
          d.Clear(this.m_edges);
          this.m_HasOpenPaths = this.m_UseFullRange = false;
        };
        d.ClipperBase.prototype.DisposeLocalMinimaList = function() {
          for (; null !== this.m_MinimaList; ) {
            var a = this.m_MinimaList.Next;
            this.m_MinimaList = null;
            this.m_MinimaList = a;
          }
          this.m_CurrentLM = null;
        };
        d.ClipperBase.prototype.RangeTest = function(a, b) {
          if (b.Value) (a.X > d.ClipperBase.hiRange || a.Y > d.ClipperBase.hiRange || -a.X > d.ClipperBase.hiRange || -a.Y > d.ClipperBase.hiRange) && d.Error("Coordinate outside allowed range in RangeTest().");
          else if (a.X > d.ClipperBase.loRange || a.Y > d.ClipperBase.loRange || -a.X > d.ClipperBase.loRange || -a.Y > d.ClipperBase.loRange) b.Value = true, this.RangeTest(a, b);
        };
        d.ClipperBase.prototype.InitEdge = function(a, b, c, e) {
          a.Next = b;
          a.Prev = c;
          a.Curr.X = e.X;
          a.Curr.Y = e.Y;
          a.OutIdx = -1;
        };
        d.ClipperBase.prototype.InitEdge2 = function(a, b) {
          a.Curr.Y >= a.Next.Curr.Y ? (a.Bot.X = a.Curr.X, a.Bot.Y = a.Curr.Y, a.Top.X = a.Next.Curr.X, a.Top.Y = a.Next.Curr.Y) : (a.Top.X = a.Curr.X, a.Top.Y = a.Curr.Y, a.Bot.X = a.Next.Curr.X, a.Bot.Y = a.Next.Curr.Y);
          this.SetDx(a);
          a.PolyTyp = b;
        };
        d.ClipperBase.prototype.FindNextLocMin = function(a) {
          for (var b; ; ) {
            for (; d.IntPoint.op_Inequality(a.Bot, a.Prev.Bot) || d.IntPoint.op_Equality(a.Curr, a.Top); ) a = a.Next;
            if (a.Dx != d.ClipperBase.horizontal && a.Prev.Dx != d.ClipperBase.horizontal) break;
            for (; a.Prev.Dx == d.ClipperBase.horizontal; ) a = a.Prev;
            for (b = a; a.Dx == d.ClipperBase.horizontal; ) a = a.Next;
            if (a.Top.Y != a.Prev.Bot.Y) {
              b.Prev.Bot.X < a.Bot.X && (a = b);
              break;
            }
          }
          return a;
        };
        d.ClipperBase.prototype.ProcessBound = function(a, b) {
          var c = a, e = a, f;
          a.Dx == d.ClipperBase.horizontal && (f = b ? a.Prev.Bot.X : a.Next.Bot.X, a.Bot.X != f && this.ReverseHorizontal(a));
          if (e.OutIdx != d.ClipperBase.Skip) if (b) {
            for (; e.Top.Y == e.Next.Bot.Y && e.Next.OutIdx != d.ClipperBase.Skip; ) e = e.Next;
            if (e.Dx == d.ClipperBase.horizontal && e.Next.OutIdx != d.ClipperBase.Skip) {
              for (f = e; f.Prev.Dx == d.ClipperBase.horizontal; ) f = f.Prev;
              f.Prev.Top.X == e.Next.Top.X ? b || (e = f.Prev) : f.Prev.Top.X > e.Next.Top.X && (e = f.Prev);
            }
            for (; a != e; ) a.NextInLML = a.Next, a.Dx == d.ClipperBase.horizontal && a != c && a.Bot.X != a.Prev.Top.X && this.ReverseHorizontal(a), a = a.Next;
            a.Dx == d.ClipperBase.horizontal && a != c && a.Bot.X != a.Prev.Top.X && this.ReverseHorizontal(a);
            e = e.Next;
          } else {
            for (; e.Top.Y == e.Prev.Bot.Y && e.Prev.OutIdx != d.ClipperBase.Skip; ) e = e.Prev;
            if (e.Dx == d.ClipperBase.horizontal && e.Prev.OutIdx != d.ClipperBase.Skip) {
              for (f = e; f.Next.Dx == d.ClipperBase.horizontal; ) f = f.Next;
              f.Next.Top.X == e.Prev.Top.X ? b || (e = f.Next) : f.Next.Top.X > e.Prev.Top.X && (e = f.Next);
            }
            for (; a != e; ) a.NextInLML = a.Prev, a.Dx == d.ClipperBase.horizontal && a != c && a.Bot.X != a.Next.Top.X && this.ReverseHorizontal(a), a = a.Prev;
            a.Dx == d.ClipperBase.horizontal && a != c && a.Bot.X != a.Next.Top.X && this.ReverseHorizontal(a);
            e = e.Prev;
          }
          if (e.OutIdx == d.ClipperBase.Skip) {
            a = e;
            if (b) {
              for (; a.Top.Y == a.Next.Bot.Y; ) a = a.Next;
              for (; a != e && a.Dx == d.ClipperBase.horizontal; ) a = a.Prev;
            } else {
              for (; a.Top.Y == a.Prev.Bot.Y; ) a = a.Prev;
              for (; a != e && a.Dx == d.ClipperBase.horizontal; ) a = a.Next;
            }
            a == e ? e = b ? a.Next : a.Prev : (a = b ? e.Next : e.Prev, c = new d.LocalMinima(), c.Next = null, c.Y = a.Bot.Y, c.LeftBound = null, c.RightBound = a, c.RightBound.WindDelta = 0, e = this.ProcessBound(c.RightBound, b), this.InsertLocalMinima(c));
          }
          return e;
        };
        d.ClipperBase.prototype.AddPath = function(a, b, c) {
          c || b != d.PolyType.ptClip || d.Error("AddPath: Open paths must be subject.");
          var e = a.length - 1;
          if (c) for (; 0 < e && d.IntPoint.op_Equality(a[e], a[0]); ) --e;
          for (; 0 < e && d.IntPoint.op_Equality(a[e], a[e - 1]); ) --e;
          if (c && 2 > e || !c && 1 > e) return false;
          for (var f = [], g = 0; g <= e; g++) f.push(new d.TEdge());
          var h = true;
          f[1].Curr.X = a[1].X;
          f[1].Curr.Y = a[1].Y;
          var l = { Value: this.m_UseFullRange };
          this.RangeTest(
            a[0],
            l
          );
          this.m_UseFullRange = l.Value;
          l.Value = this.m_UseFullRange;
          this.RangeTest(a[e], l);
          this.m_UseFullRange = l.Value;
          this.InitEdge(f[0], f[1], f[e], a[0]);
          this.InitEdge(f[e], f[0], f[e - 1], a[e]);
          for (g = e - 1; 1 <= g; --g) l.Value = this.m_UseFullRange, this.RangeTest(a[g], l), this.m_UseFullRange = l.Value, this.InitEdge(f[g], f[g + 1], f[g - 1], a[g]);
          for (g = a = e = f[0]; ; ) if (d.IntPoint.op_Equality(a.Curr, a.Next.Curr)) {
            if (a == a.Next) break;
            a == e && (e = a.Next);
            g = a = this.RemoveEdge(a);
          } else {
            if (a.Prev == a.Next) break;
            else if (c && d.ClipperBase.SlopesEqual(
              a.Prev.Curr,
              a.Curr,
              a.Next.Curr,
              this.m_UseFullRange
            ) && (!this.PreserveCollinear || !this.Pt2IsBetweenPt1AndPt3(a.Prev.Curr, a.Curr, a.Next.Curr))) {
              a == e && (e = a.Next);
              a = this.RemoveEdge(a);
              g = a = a.Prev;
              continue;
            }
            a = a.Next;
            if (a == g) break;
          }
          if (!c && a == a.Next || c && a.Prev == a.Next) return false;
          c || (this.m_HasOpenPaths = true, e.Prev.OutIdx = d.ClipperBase.Skip);
          a = e;
          do
            this.InitEdge2(a, b), a = a.Next, h && a.Curr.Y != e.Curr.Y && (h = false);
          while (a != e);
          if (h) {
            if (c) return false;
            a.Prev.OutIdx = d.ClipperBase.Skip;
            a.Prev.Bot.X < a.Prev.Top.X && this.ReverseHorizontal(a.Prev);
            b = new d.LocalMinima();
            b.Next = null;
            b.Y = a.Bot.Y;
            b.LeftBound = null;
            b.RightBound = a;
            b.RightBound.Side = d.EdgeSide.esRight;
            for (b.RightBound.WindDelta = 0; a.Next.OutIdx != d.ClipperBase.Skip; ) a.NextInLML = a.Next, a.Bot.X != a.Prev.Top.X && this.ReverseHorizontal(a), a = a.Next;
            this.InsertLocalMinima(b);
            this.m_edges.push(f);
            return true;
          }
          this.m_edges.push(f);
          for (h = null; ; ) {
            a = this.FindNextLocMin(a);
            if (a == h) break;
            else null == h && (h = a);
            b = new d.LocalMinima();
            b.Next = null;
            b.Y = a.Bot.Y;
            a.Dx < a.Prev.Dx ? (b.LeftBound = a.Prev, b.RightBound = a, f = false) : (b.LeftBound = a, b.RightBound = a.Prev, f = true);
            b.LeftBound.Side = d.EdgeSide.esLeft;
            b.RightBound.Side = d.EdgeSide.esRight;
            b.LeftBound.WindDelta = c ? b.LeftBound.Next == b.RightBound ? -1 : 1 : 0;
            b.RightBound.WindDelta = -b.LeftBound.WindDelta;
            a = this.ProcessBound(b.LeftBound, f);
            e = this.ProcessBound(b.RightBound, !f);
            b.LeftBound.OutIdx == d.ClipperBase.Skip ? b.LeftBound = null : b.RightBound.OutIdx == d.ClipperBase.Skip && (b.RightBound = null);
            this.InsertLocalMinima(b);
            f || (a = e);
          }
          return true;
        };
        d.ClipperBase.prototype.AddPaths = function(a, b, c) {
          for (var e = false, d2 = 0, g = a.length; d2 < g; ++d2) this.AddPath(a[d2], b, c) && (e = true);
          return e;
        };
        d.ClipperBase.prototype.Pt2IsBetweenPt1AndPt3 = function(a, b, c) {
          return d.IntPoint.op_Equality(a, c) || d.IntPoint.op_Equality(a, b) || d.IntPoint.op_Equality(c, b) ? false : a.X != c.X ? b.X > a.X == b.X < c.X : b.Y > a.Y == b.Y < c.Y;
        };
        d.ClipperBase.prototype.RemoveEdge = function(a) {
          a.Prev.Next = a.Next;
          a.Next.Prev = a.Prev;
          var b = a.Next;
          a.Prev = null;
          return b;
        };
        d.ClipperBase.prototype.SetDx = function(a) {
          a.Delta.X = a.Top.X - a.Bot.X;
          a.Delta.Y = a.Top.Y - a.Bot.Y;
          a.Dx = 0 === a.Delta.Y ? d.ClipperBase.horizontal : a.Delta.X / a.Delta.Y;
        };
        d.ClipperBase.prototype.InsertLocalMinima = function(a) {
          if (null === this.m_MinimaList) this.m_MinimaList = a;
          else if (a.Y >= this.m_MinimaList.Y) a.Next = this.m_MinimaList, this.m_MinimaList = a;
          else {
            for (var b = this.m_MinimaList; null !== b.Next && a.Y < b.Next.Y; ) b = b.Next;
            a.Next = b.Next;
            b.Next = a;
          }
        };
        d.ClipperBase.prototype.PopLocalMinima = function() {
          null !== this.m_CurrentLM && (this.m_CurrentLM = this.m_CurrentLM.Next);
        };
        d.ClipperBase.prototype.ReverseHorizontal = function(a) {
          var b = a.Top.X;
          a.Top.X = a.Bot.X;
          a.Bot.X = b;
        };
        d.ClipperBase.prototype.Reset = function() {
          this.m_CurrentLM = this.m_MinimaList;
          if (null != this.m_CurrentLM) for (var a = this.m_MinimaList; null != a; ) {
            var b = a.LeftBound;
            null != b && (b.Curr.X = b.Bot.X, b.Curr.Y = b.Bot.Y, b.Side = d.EdgeSide.esLeft, b.OutIdx = d.ClipperBase.Unassigned);
            b = a.RightBound;
            null != b && (b.Curr.X = b.Bot.X, b.Curr.Y = b.Bot.Y, b.Side = d.EdgeSide.esRight, b.OutIdx = d.ClipperBase.Unassigned);
            a = a.Next;
          }
        };
        d.Clipper = function(a) {
          "undefined" == typeof a && (a = 0);
          this.m_PolyOuts = null;
          this.m_ClipType = d.ClipType.ctIntersection;
          this.m_IntersectNodeComparer = this.m_IntersectList = this.m_SortedEdges = this.m_ActiveEdges = this.m_Scanbeam = null;
          this.m_ExecuteLocked = false;
          this.m_SubjFillType = this.m_ClipFillType = d.PolyFillType.pftEvenOdd;
          this.m_GhostJoins = this.m_Joins = null;
          this.StrictlySimple = this.ReverseSolution = this.m_UsingPolyTree = false;
          d.ClipperBase.call(this);
          this.m_SortedEdges = this.m_ActiveEdges = this.m_Scanbeam = null;
          this.m_IntersectList = [];
          this.m_IntersectNodeComparer = d.MyIntersectNodeSort.Compare;
          this.m_UsingPolyTree = this.m_ExecuteLocked = false;
          this.m_PolyOuts = [];
          this.m_Joins = [];
          this.m_GhostJoins = [];
          this.ReverseSolution = 0 !== (1 & a);
          this.StrictlySimple = 0 !== (2 & a);
          this.PreserveCollinear = 0 !== (4 & a);
        };
        d.Clipper.ioReverseSolution = 1;
        d.Clipper.ioStrictlySimple = 2;
        d.Clipper.ioPreserveCollinear = 4;
        d.Clipper.prototype.Clear = function() {
          0 !== this.m_edges.length && (this.DisposeAllPolyPts(), d.ClipperBase.prototype.Clear.call(this));
        };
        d.Clipper.prototype.DisposeScanbeamList = function() {
          for (; null !== this.m_Scanbeam; ) {
            var a = this.m_Scanbeam.Next;
            this.m_Scanbeam = null;
            this.m_Scanbeam = a;
          }
        };
        d.Clipper.prototype.Reset = function() {
          d.ClipperBase.prototype.Reset.call(this);
          this.m_SortedEdges = this.m_ActiveEdges = this.m_Scanbeam = null;
          for (var a = this.m_MinimaList; null !== a; ) this.InsertScanbeam(a.Y), a = a.Next;
        };
        d.Clipper.prototype.InsertScanbeam = function(a) {
          if (null === this.m_Scanbeam) this.m_Scanbeam = new d.Scanbeam(), this.m_Scanbeam.Next = null, this.m_Scanbeam.Y = a;
          else if (a > this.m_Scanbeam.Y) {
            var b = new d.Scanbeam();
            b.Y = a;
            b.Next = this.m_Scanbeam;
            this.m_Scanbeam = b;
          } else {
            for (var c = this.m_Scanbeam; null !== c.Next && a <= c.Next.Y; ) c = c.Next;
            a != c.Y && (b = new d.Scanbeam(), b.Y = a, b.Next = c.Next, c.Next = b);
          }
        };
        d.Clipper.prototype.Execute = function() {
          var a = arguments, b = a.length, c = a[1] instanceof d.PolyTree;
          if (4 != b || c) {
            if (4 == b && c) {
              var b = a[0], e = a[1], c = a[2], a = a[3];
              if (this.m_ExecuteLocked) return false;
              this.m_ExecuteLocked = true;
              this.m_SubjFillType = c;
              this.m_ClipFillType = a;
              this.m_ClipType = b;
              this.m_UsingPolyTree = true;
              try {
                (f = this.ExecuteInternal()) && this.BuildResult2(e);
              } finally {
                this.DisposeAllPolyPts(), this.m_ExecuteLocked = false;
              }
              return f;
            }
            if (2 == b && !c || 2 == b && c) return b = a[0], e = a[1], this.Execute(b, e, d.PolyFillType.pftEvenOdd, d.PolyFillType.pftEvenOdd);
          } else {
            b = a[0];
            e = a[1];
            c = a[2];
            a = a[3];
            if (this.m_ExecuteLocked) return false;
            this.m_HasOpenPaths && d.Error("Error: PolyTree struct is need for open path clipping.");
            this.m_ExecuteLocked = true;
            d.Clear(e);
            this.m_SubjFillType = c;
            this.m_ClipFillType = a;
            this.m_ClipType = b;
            this.m_UsingPolyTree = false;
            try {
              var f = this.ExecuteInternal();
              f && this.BuildResult(e);
            } finally {
              this.DisposeAllPolyPts(), this.m_ExecuteLocked = false;
            }
            return f;
          }
        };
        d.Clipper.prototype.FixHoleLinkage = function(a) {
          if (null !== a.FirstLeft && (a.IsHole == a.FirstLeft.IsHole || null === a.FirstLeft.Pts)) {
            for (var b = a.FirstLeft; null !== b && (b.IsHole == a.IsHole || null === b.Pts); ) b = b.FirstLeft;
            a.FirstLeft = b;
          }
        };
        d.Clipper.prototype.ExecuteInternal = function() {
          try {
            this.Reset();
            if (null === this.m_CurrentLM) return false;
            var a = this.PopScanbeam();
            do {
              this.InsertLocalMinimaIntoAEL(a);
              d.Clear(this.m_GhostJoins);
              this.ProcessHorizontals(false);
              if (null === this.m_Scanbeam) break;
              var b = this.PopScanbeam();
              if (!this.ProcessIntersections(a, b)) return false;
              this.ProcessEdgesAtTopOfScanbeam(b);
              a = b;
            } while (null !== this.m_Scanbeam || null !== this.m_CurrentLM);
            for (var a = 0, c = this.m_PolyOuts.length; a < c; a++) {
              var e = this.m_PolyOuts[a];
              null === e.Pts || e.IsOpen || (e.IsHole ^ this.ReverseSolution) == 0 < this.Area(e) && this.ReversePolyPtLinks(e.Pts);
            }
            this.JoinCommonEdges();
            a = 0;
            for (c = this.m_PolyOuts.length; a < c; a++) e = this.m_PolyOuts[a], null === e.Pts || e.IsOpen || this.FixupOutPolygon(e);
            this.StrictlySimple && this.DoSimplePolygons();
            return true;
          } finally {
            d.Clear(this.m_Joins), d.Clear(this.m_GhostJoins);
          }
        };
        d.Clipper.prototype.PopScanbeam = function() {
          var a = this.m_Scanbeam.Y;
          this.m_Scanbeam = this.m_Scanbeam.Next;
          return a;
        };
        d.Clipper.prototype.DisposeAllPolyPts = function() {
          for (var a = 0, b = this.m_PolyOuts.length; a < b; ++a) this.DisposeOutRec(a);
          d.Clear(this.m_PolyOuts);
        };
        d.Clipper.prototype.DisposeOutRec = function(a) {
          var b = this.m_PolyOuts[a];
          null !== b.Pts && this.DisposeOutPts(b.Pts);
          this.m_PolyOuts[a] = null;
        };
        d.Clipper.prototype.DisposeOutPts = function(a) {
          if (null !== a) for (a.Prev.Next = null; null !== a; ) a = a.Next;
        };
        d.Clipper.prototype.AddJoin = function(a, b, c) {
          var e = new d.Join();
          e.OutPt1 = a;
          e.OutPt2 = b;
          e.OffPt.X = c.X;
          e.OffPt.Y = c.Y;
          this.m_Joins.push(e);
        };
        d.Clipper.prototype.AddGhostJoin = function(a, b) {
          var c = new d.Join();
          c.OutPt1 = a;
          c.OffPt.X = b.X;
          c.OffPt.Y = b.Y;
          this.m_GhostJoins.push(c);
        };
        d.Clipper.prototype.InsertLocalMinimaIntoAEL = function(a) {
          for (; null !== this.m_CurrentLM && this.m_CurrentLM.Y == a; ) {
            var b = this.m_CurrentLM.LeftBound, c = this.m_CurrentLM.RightBound;
            this.PopLocalMinima();
            var e = null;
            null === b ? (this.InsertEdgeIntoAEL(
              c,
              null
            ), this.SetWindingCount(c), this.IsContributing(c) && (e = this.AddOutPt(c, c.Bot))) : (null == c ? (this.InsertEdgeIntoAEL(b, null), this.SetWindingCount(b), this.IsContributing(b) && (e = this.AddOutPt(b, b.Bot))) : (this.InsertEdgeIntoAEL(b, null), this.InsertEdgeIntoAEL(c, b), this.SetWindingCount(b), c.WindCnt = b.WindCnt, c.WindCnt2 = b.WindCnt2, this.IsContributing(b) && (e = this.AddLocalMinPoly(b, c, b.Bot))), this.InsertScanbeam(b.Top.Y));
            null != c && (d.ClipperBase.IsHorizontal(c) ? this.AddEdgeToSEL(c) : this.InsertScanbeam(c.Top.Y));
            if (null != b && null != c) {
              if (null !== e && d.ClipperBase.IsHorizontal(c) && 0 < this.m_GhostJoins.length && 0 !== c.WindDelta) for (var f = 0, g = this.m_GhostJoins.length; f < g; f++) {
                var h = this.m_GhostJoins[f];
                this.HorzSegmentsOverlap(h.OutPt1.Pt, h.OffPt, c.Bot, c.Top) && this.AddJoin(h.OutPt1, e, h.OffPt);
              }
              0 <= b.OutIdx && null !== b.PrevInAEL && b.PrevInAEL.Curr.X == b.Bot.X && 0 <= b.PrevInAEL.OutIdx && d.ClipperBase.SlopesEqual(b.PrevInAEL, b, this.m_UseFullRange) && 0 !== b.WindDelta && 0 !== b.PrevInAEL.WindDelta && (f = this.AddOutPt(b.PrevInAEL, b.Bot), this.AddJoin(e, f, b.Top));
              if (b.NextInAEL != c && (0 <= c.OutIdx && 0 <= c.PrevInAEL.OutIdx && d.ClipperBase.SlopesEqual(c.PrevInAEL, c, this.m_UseFullRange) && 0 !== c.WindDelta && 0 !== c.PrevInAEL.WindDelta && (f = this.AddOutPt(c.PrevInAEL, c.Bot), this.AddJoin(e, f, c.Top)), e = b.NextInAEL, null !== e)) for (; e != c; ) this.IntersectEdges(c, e, b.Curr, false), e = e.NextInAEL;
            }
          }
        };
        d.Clipper.prototype.InsertEdgeIntoAEL = function(a, b) {
          if (null === this.m_ActiveEdges) a.PrevInAEL = null, a.NextInAEL = null, this.m_ActiveEdges = a;
          else if (null === b && this.E2InsertsBeforeE1(
            this.m_ActiveEdges,
            a
          )) a.PrevInAEL = null, a.NextInAEL = this.m_ActiveEdges, this.m_ActiveEdges = this.m_ActiveEdges.PrevInAEL = a;
          else {
            null === b && (b = this.m_ActiveEdges);
            for (; null !== b.NextInAEL && !this.E2InsertsBeforeE1(b.NextInAEL, a); ) b = b.NextInAEL;
            a.NextInAEL = b.NextInAEL;
            null !== b.NextInAEL && (b.NextInAEL.PrevInAEL = a);
            a.PrevInAEL = b;
            b.NextInAEL = a;
          }
        };
        d.Clipper.prototype.E2InsertsBeforeE1 = function(a, b) {
          return b.Curr.X == a.Curr.X ? b.Top.Y > a.Top.Y ? b.Top.X < d.Clipper.TopX(a, b.Top.Y) : a.Top.X > d.Clipper.TopX(b, a.Top.Y) : b.Curr.X < a.Curr.X;
        };
        d.Clipper.prototype.IsEvenOddFillType = function(a) {
          return a.PolyTyp == d.PolyType.ptSubject ? this.m_SubjFillType == d.PolyFillType.pftEvenOdd : this.m_ClipFillType == d.PolyFillType.pftEvenOdd;
        };
        d.Clipper.prototype.IsEvenOddAltFillType = function(a) {
          return a.PolyTyp == d.PolyType.ptSubject ? this.m_ClipFillType == d.PolyFillType.pftEvenOdd : this.m_SubjFillType == d.PolyFillType.pftEvenOdd;
        };
        d.Clipper.prototype.IsContributing = function(a) {
          var b, c;
          a.PolyTyp == d.PolyType.ptSubject ? (b = this.m_SubjFillType, c = this.m_ClipFillType) : (b = this.m_ClipFillType, c = this.m_SubjFillType);
          switch (b) {
            case d.PolyFillType.pftEvenOdd:
              if (0 === a.WindDelta && 1 != a.WindCnt) return false;
              break;
            case d.PolyFillType.pftNonZero:
              if (1 != Math.abs(a.WindCnt)) return false;
              break;
            case d.PolyFillType.pftPositive:
              if (1 != a.WindCnt) return false;
              break;
            default:
              if (-1 != a.WindCnt) return false;
          }
          switch (this.m_ClipType) {
            case d.ClipType.ctIntersection:
              switch (c) {
                case d.PolyFillType.pftEvenOdd:
                case d.PolyFillType.pftNonZero:
                  return 0 !== a.WindCnt2;
                case d.PolyFillType.pftPositive:
                  return 0 < a.WindCnt2;
                default:
                  return 0 > a.WindCnt2;
              }
            case d.ClipType.ctUnion:
              switch (c) {
                case d.PolyFillType.pftEvenOdd:
                case d.PolyFillType.pftNonZero:
                  return 0 === a.WindCnt2;
                case d.PolyFillType.pftPositive:
                  return 0 >= a.WindCnt2;
                default:
                  return 0 <= a.WindCnt2;
              }
            case d.ClipType.ctDifference:
              if (a.PolyTyp == d.PolyType.ptSubject) switch (c) {
                case d.PolyFillType.pftEvenOdd:
                case d.PolyFillType.pftNonZero:
                  return 0 === a.WindCnt2;
                case d.PolyFillType.pftPositive:
                  return 0 >= a.WindCnt2;
                default:
                  return 0 <= a.WindCnt2;
              }
              else switch (c) {
                case d.PolyFillType.pftEvenOdd:
                case d.PolyFillType.pftNonZero:
                  return 0 !== a.WindCnt2;
                case d.PolyFillType.pftPositive:
                  return 0 < a.WindCnt2;
                default:
                  return 0 > a.WindCnt2;
              }
            case d.ClipType.ctXor:
              if (0 === a.WindDelta) switch (c) {
                case d.PolyFillType.pftEvenOdd:
                case d.PolyFillType.pftNonZero:
                  return 0 === a.WindCnt2;
                case d.PolyFillType.pftPositive:
                  return 0 >= a.WindCnt2;
                default:
                  return 0 <= a.WindCnt2;
              }
          }
          return true;
        };
        d.Clipper.prototype.SetWindingCount = function(a) {
          for (var b = a.PrevInAEL; null !== b && (b.PolyTyp != a.PolyTyp || 0 === b.WindDelta); ) b = b.PrevInAEL;
          if (null === b) a.WindCnt = 0 === a.WindDelta ? 1 : a.WindDelta, a.WindCnt2 = 0, b = this.m_ActiveEdges;
          else {
            if (0 === a.WindDelta && this.m_ClipType != d.ClipType.ctUnion) a.WindCnt = 1;
            else if (this.IsEvenOddFillType(a)) if (0 === a.WindDelta) {
              for (var c = true, e = b.PrevInAEL; null !== e; ) e.PolyTyp == b.PolyTyp && 0 !== e.WindDelta && (c = !c), e = e.PrevInAEL;
              a.WindCnt = c ? 0 : 1;
            } else a.WindCnt = a.WindDelta;
            else 0 > b.WindCnt * b.WindDelta ? 1 < Math.abs(b.WindCnt) ? a.WindCnt = 0 > b.WindDelta * a.WindDelta ? b.WindCnt : b.WindCnt + a.WindDelta : a.WindCnt = 0 === a.WindDelta ? 1 : a.WindDelta : a.WindCnt = 0 === a.WindDelta ? 0 > b.WindCnt ? b.WindCnt - 1 : b.WindCnt + 1 : 0 > b.WindDelta * a.WindDelta ? b.WindCnt : b.WindCnt + a.WindDelta;
            a.WindCnt2 = b.WindCnt2;
            b = b.NextInAEL;
          }
          if (this.IsEvenOddAltFillType(a)) for (; b != a; ) 0 !== b.WindDelta && (a.WindCnt2 = 0 === a.WindCnt2 ? 1 : 0), b = b.NextInAEL;
          else for (; b != a; ) a.WindCnt2 += b.WindDelta, b = b.NextInAEL;
        };
        d.Clipper.prototype.AddEdgeToSEL = function(a) {
          null === this.m_SortedEdges ? (this.m_SortedEdges = a, a.PrevInSEL = null, a.NextInSEL = null) : (a.NextInSEL = this.m_SortedEdges, a.PrevInSEL = null, this.m_SortedEdges = this.m_SortedEdges.PrevInSEL = a);
        };
        d.Clipper.prototype.CopyAELToSEL = function() {
          var a = this.m_ActiveEdges;
          for (this.m_SortedEdges = a; null !== a; ) a.PrevInSEL = a.PrevInAEL, a = a.NextInSEL = a.NextInAEL;
        };
        d.Clipper.prototype.SwapPositionsInAEL = function(a, b) {
          if (a.NextInAEL != a.PrevInAEL && b.NextInAEL != b.PrevInAEL) {
            if (a.NextInAEL == b) {
              var c = b.NextInAEL;
              null !== c && (c.PrevInAEL = a);
              var e = a.PrevInAEL;
              null !== e && (e.NextInAEL = b);
              b.PrevInAEL = e;
              b.NextInAEL = a;
              a.PrevInAEL = b;
              a.NextInAEL = c;
            } else b.NextInAEL == a ? (c = a.NextInAEL, null !== c && (c.PrevInAEL = b), e = b.PrevInAEL, null !== e && (e.NextInAEL = a), a.PrevInAEL = e, a.NextInAEL = b, b.PrevInAEL = a, b.NextInAEL = c) : (c = a.NextInAEL, e = a.PrevInAEL, a.NextInAEL = b.NextInAEL, null !== a.NextInAEL && (a.NextInAEL.PrevInAEL = a), a.PrevInAEL = b.PrevInAEL, null !== a.PrevInAEL && (a.PrevInAEL.NextInAEL = a), b.NextInAEL = c, null !== b.NextInAEL && (b.NextInAEL.PrevInAEL = b), b.PrevInAEL = e, null !== b.PrevInAEL && (b.PrevInAEL.NextInAEL = b));
            null === a.PrevInAEL ? this.m_ActiveEdges = a : null === b.PrevInAEL && (this.m_ActiveEdges = b);
          }
        };
        d.Clipper.prototype.SwapPositionsInSEL = function(a, b) {
          if (null !== a.NextInSEL || null !== a.PrevInSEL) {
            if (null !== b.NextInSEL || null !== b.PrevInSEL) {
              if (a.NextInSEL == b) {
                var c = b.NextInSEL;
                null !== c && (c.PrevInSEL = a);
                var e = a.PrevInSEL;
                null !== e && (e.NextInSEL = b);
                b.PrevInSEL = e;
                b.NextInSEL = a;
                a.PrevInSEL = b;
                a.NextInSEL = c;
              } else b.NextInSEL == a ? (c = a.NextInSEL, null !== c && (c.PrevInSEL = b), e = b.PrevInSEL, null !== e && (e.NextInSEL = a), a.PrevInSEL = e, a.NextInSEL = b, b.PrevInSEL = a, b.NextInSEL = c) : (c = a.NextInSEL, e = a.PrevInSEL, a.NextInSEL = b.NextInSEL, null !== a.NextInSEL && (a.NextInSEL.PrevInSEL = a), a.PrevInSEL = b.PrevInSEL, null !== a.PrevInSEL && (a.PrevInSEL.NextInSEL = a), b.NextInSEL = c, null !== b.NextInSEL && (b.NextInSEL.PrevInSEL = b), b.PrevInSEL = e, null !== b.PrevInSEL && (b.PrevInSEL.NextInSEL = b));
              null === a.PrevInSEL ? this.m_SortedEdges = a : null === b.PrevInSEL && (this.m_SortedEdges = b);
            }
          }
        };
        d.Clipper.prototype.AddLocalMaxPoly = function(a, b, c) {
          this.AddOutPt(a, c);
          0 == b.WindDelta && this.AddOutPt(b, c);
          a.OutIdx == b.OutIdx ? (a.OutIdx = -1, b.OutIdx = -1) : a.OutIdx < b.OutIdx ? this.AppendPolygon(a, b) : this.AppendPolygon(b, a);
        };
        d.Clipper.prototype.AddLocalMinPoly = function(a, b, c) {
          var e, f;
          d.ClipperBase.IsHorizontal(b) || a.Dx > b.Dx ? (e = this.AddOutPt(
            a,
            c
          ), b.OutIdx = a.OutIdx, a.Side = d.EdgeSide.esLeft, b.Side = d.EdgeSide.esRight, f = a, a = f.PrevInAEL == b ? b.PrevInAEL : f.PrevInAEL) : (e = this.AddOutPt(b, c), a.OutIdx = b.OutIdx, a.Side = d.EdgeSide.esRight, b.Side = d.EdgeSide.esLeft, f = b, a = f.PrevInAEL == a ? a.PrevInAEL : f.PrevInAEL);
          null !== a && 0 <= a.OutIdx && d.Clipper.TopX(a, c.Y) == d.Clipper.TopX(f, c.Y) && d.ClipperBase.SlopesEqual(f, a, this.m_UseFullRange) && 0 !== f.WindDelta && 0 !== a.WindDelta && (c = this.AddOutPt(a, c), this.AddJoin(e, c, f.Top));
          return e;
        };
        d.Clipper.prototype.CreateOutRec = function() {
          var a = new d.OutRec();
          a.Idx = -1;
          a.IsHole = false;
          a.IsOpen = false;
          a.FirstLeft = null;
          a.Pts = null;
          a.BottomPt = null;
          a.PolyNode = null;
          this.m_PolyOuts.push(a);
          a.Idx = this.m_PolyOuts.length - 1;
          return a;
        };
        d.Clipper.prototype.AddOutPt = function(a, b) {
          var c = a.Side == d.EdgeSide.esLeft;
          if (0 > a.OutIdx) {
            var e = this.CreateOutRec();
            e.IsOpen = 0 === a.WindDelta;
            var f = new d.OutPt();
            e.Pts = f;
            f.Idx = e.Idx;
            f.Pt.X = b.X;
            f.Pt.Y = b.Y;
            f.Next = f;
            f.Prev = f;
            e.IsOpen || this.SetHoleState(a, e);
            a.OutIdx = e.Idx;
          } else {
            var e = this.m_PolyOuts[a.OutIdx], g = e.Pts;
            if (c && d.IntPoint.op_Equality(
              b,
              g.Pt
            )) return g;
            if (!c && d.IntPoint.op_Equality(b, g.Prev.Pt)) return g.Prev;
            f = new d.OutPt();
            f.Idx = e.Idx;
            f.Pt.X = b.X;
            f.Pt.Y = b.Y;
            f.Next = g;
            f.Prev = g.Prev;
            f.Prev.Next = f;
            g.Prev = f;
            c && (e.Pts = f);
          }
          return f;
        };
        d.Clipper.prototype.SwapPoints = function(a, b) {
          var c = new d.IntPoint(a.Value);
          a.Value.X = b.Value.X;
          a.Value.Y = b.Value.Y;
          b.Value.X = c.X;
          b.Value.Y = c.Y;
        };
        d.Clipper.prototype.HorzSegmentsOverlap = function(a, b, c, e) {
          return a.X > c.X == a.X < e.X ? true : b.X > c.X == b.X < e.X ? true : c.X > a.X == c.X < b.X ? true : e.X > a.X == e.X < b.X ? true : a.X == c.X && b.X == e.X ? true : a.X == e.X && b.X == c.X ? true : false;
        };
        d.Clipper.prototype.InsertPolyPtBetween = function(a, b, c) {
          var e = new d.OutPt();
          e.Pt.X = c.X;
          e.Pt.Y = c.Y;
          b == a.Next ? (a.Next = e, b.Prev = e, e.Next = b, e.Prev = a) : (b.Next = e, a.Prev = e, e.Next = a, e.Prev = b);
          return e;
        };
        d.Clipper.prototype.SetHoleState = function(a, b) {
          for (var c = false, e = a.PrevInAEL; null !== e; ) 0 <= e.OutIdx && 0 != e.WindDelta && (c = !c, null === b.FirstLeft && (b.FirstLeft = this.m_PolyOuts[e.OutIdx])), e = e.PrevInAEL;
          c && (b.IsHole = true);
        };
        d.Clipper.prototype.GetDx = function(a, b) {
          return a.Y == b.Y ? d.ClipperBase.horizontal : (b.X - a.X) / (b.Y - a.Y);
        };
        d.Clipper.prototype.FirstIsBottomPt = function(a, b) {
          for (var c = a.Prev; d.IntPoint.op_Equality(c.Pt, a.Pt) && c != a; ) c = c.Prev;
          for (var e = Math.abs(this.GetDx(a.Pt, c.Pt)), c = a.Next; d.IntPoint.op_Equality(c.Pt, a.Pt) && c != a; ) c = c.Next;
          for (var f = Math.abs(this.GetDx(a.Pt, c.Pt)), c = b.Prev; d.IntPoint.op_Equality(c.Pt, b.Pt) && c != b; ) c = c.Prev;
          for (var g = Math.abs(this.GetDx(b.Pt, c.Pt)), c = b.Next; d.IntPoint.op_Equality(c.Pt, b.Pt) && c != b; ) c = c.Next;
          c = Math.abs(this.GetDx(b.Pt, c.Pt));
          return e >= g && e >= c || f >= g && f >= c;
        };
        d.Clipper.prototype.GetBottomPt = function(a) {
          for (var b = null, c = a.Next; c != a; ) c.Pt.Y > a.Pt.Y ? (a = c, b = null) : c.Pt.Y == a.Pt.Y && c.Pt.X <= a.Pt.X && (c.Pt.X < a.Pt.X ? (b = null, a = c) : c.Next != a && c.Prev != a && (b = c)), c = c.Next;
          if (null !== b) for (; b != c; ) for (this.FirstIsBottomPt(c, b) || (a = b), b = b.Next; d.IntPoint.op_Inequality(b.Pt, a.Pt); ) b = b.Next;
          return a;
        };
        d.Clipper.prototype.GetLowermostRec = function(a, b) {
          null === a.BottomPt && (a.BottomPt = this.GetBottomPt(a.Pts));
          null === b.BottomPt && (b.BottomPt = this.GetBottomPt(b.Pts));
          var c = a.BottomPt, e = b.BottomPt;
          return c.Pt.Y > e.Pt.Y ? a : c.Pt.Y < e.Pt.Y ? b : c.Pt.X < e.Pt.X ? a : c.Pt.X > e.Pt.X ? b : c.Next == c ? b : e.Next == e ? a : this.FirstIsBottomPt(c, e) ? a : b;
        };
        d.Clipper.prototype.Param1RightOfParam2 = function(a, b) {
          do
            if (a = a.FirstLeft, a == b) return true;
          while (null !== a);
          return false;
        };
        d.Clipper.prototype.GetOutRec = function(a) {
          for (a = this.m_PolyOuts[a]; a != this.m_PolyOuts[a.Idx]; ) a = this.m_PolyOuts[a.Idx];
          return a;
        };
        d.Clipper.prototype.AppendPolygon = function(a, b) {
          var c = this.m_PolyOuts[a.OutIdx], e = this.m_PolyOuts[b.OutIdx], f;
          f = this.Param1RightOfParam2(
            c,
            e
          ) ? e : this.Param1RightOfParam2(e, c) ? c : this.GetLowermostRec(c, e);
          var g = c.Pts, h = g.Prev, l = e.Pts, k2 = l.Prev;
          a.Side == d.EdgeSide.esLeft ? (b.Side == d.EdgeSide.esLeft ? (this.ReversePolyPtLinks(l), l.Next = g, g.Prev = l, h.Next = k2, k2.Prev = h, c.Pts = k2) : (k2.Next = g, g.Prev = k2, l.Prev = h, h.Next = l, c.Pts = l), g = d.EdgeSide.esLeft) : (b.Side == d.EdgeSide.esRight ? (this.ReversePolyPtLinks(l), h.Next = k2, k2.Prev = h, l.Next = g, g.Prev = l) : (h.Next = l, l.Prev = h, g.Prev = k2, k2.Next = g), g = d.EdgeSide.esRight);
          c.BottomPt = null;
          f == e && (e.FirstLeft != c && (c.FirstLeft = e.FirstLeft), c.IsHole = e.IsHole);
          e.Pts = null;
          e.BottomPt = null;
          e.FirstLeft = c;
          f = a.OutIdx;
          h = b.OutIdx;
          a.OutIdx = -1;
          b.OutIdx = -1;
          for (l = this.m_ActiveEdges; null !== l; ) {
            if (l.OutIdx == h) {
              l.OutIdx = f;
              l.Side = g;
              break;
            }
            l = l.NextInAEL;
          }
          e.Idx = c.Idx;
        };
        d.Clipper.prototype.ReversePolyPtLinks = function(a) {
          if (null !== a) {
            var b, c;
            b = a;
            do
              c = b.Next, b.Next = b.Prev, b = b.Prev = c;
            while (b != a);
          }
        };
        d.Clipper.SwapSides = function(a, b) {
          var c = a.Side;
          a.Side = b.Side;
          b.Side = c;
        };
        d.Clipper.SwapPolyIndexes = function(a, b) {
          var c = a.OutIdx;
          a.OutIdx = b.OutIdx;
          b.OutIdx = c;
        };
        d.Clipper.prototype.IntersectEdges = function(a, b, c, e) {
          var f = !e && null === a.NextInLML && a.Top.X == c.X && a.Top.Y == c.Y;
          e = !e && null === b.NextInLML && b.Top.X == c.X && b.Top.Y == c.Y;
          var g = 0 <= a.OutIdx, h = 0 <= b.OutIdx;
          if (0 === a.WindDelta || 0 === b.WindDelta) 0 === a.WindDelta && 0 === b.WindDelta ? (f || e) && g && h && this.AddLocalMaxPoly(a, b, c) : a.PolyTyp == b.PolyTyp && a.WindDelta != b.WindDelta && this.m_ClipType == d.ClipType.ctUnion ? 0 === a.WindDelta ? h && (this.AddOutPt(a, c), g && (a.OutIdx = -1)) : g && (this.AddOutPt(b, c), h && (b.OutIdx = -1)) : a.PolyTyp != b.PolyTyp && (0 !== a.WindDelta || 1 != Math.abs(b.WindCnt) || this.m_ClipType == d.ClipType.ctUnion && 0 !== b.WindCnt2 ? 0 !== b.WindDelta || 1 != Math.abs(a.WindCnt) || this.m_ClipType == d.ClipType.ctUnion && 0 !== a.WindCnt2 || (this.AddOutPt(b, c), h && (b.OutIdx = -1)) : (this.AddOutPt(a, c), g && (a.OutIdx = -1))), f && (0 > a.OutIdx ? this.DeleteFromAEL(a) : d.Error("Error intersecting polylines")), e && (0 > b.OutIdx ? this.DeleteFromAEL(b) : d.Error("Error intersecting polylines"));
          else {
            if (a.PolyTyp == b.PolyTyp) if (this.IsEvenOddFillType(a)) {
              var l = a.WindCnt;
              a.WindCnt = b.WindCnt;
              b.WindCnt = l;
            } else a.WindCnt = 0 === a.WindCnt + b.WindDelta ? -a.WindCnt : a.WindCnt + b.WindDelta, b.WindCnt = 0 === b.WindCnt - a.WindDelta ? -b.WindCnt : b.WindCnt - a.WindDelta;
            else this.IsEvenOddFillType(b) ? a.WindCnt2 = 0 === a.WindCnt2 ? 1 : 0 : a.WindCnt2 += b.WindDelta, this.IsEvenOddFillType(a) ? b.WindCnt2 = 0 === b.WindCnt2 ? 1 : 0 : b.WindCnt2 -= a.WindDelta;
            var k2, n, m2;
            a.PolyTyp == d.PolyType.ptSubject ? (k2 = this.m_SubjFillType, m2 = this.m_ClipFillType) : (k2 = this.m_ClipFillType, m2 = this.m_SubjFillType);
            b.PolyTyp == d.PolyType.ptSubject ? (n = this.m_SubjFillType, l = this.m_ClipFillType) : (n = this.m_ClipFillType, l = this.m_SubjFillType);
            switch (k2) {
              case d.PolyFillType.pftPositive:
                k2 = a.WindCnt;
                break;
              case d.PolyFillType.pftNegative:
                k2 = -a.WindCnt;
                break;
              default:
                k2 = Math.abs(a.WindCnt);
            }
            switch (n) {
              case d.PolyFillType.pftPositive:
                n = b.WindCnt;
                break;
              case d.PolyFillType.pftNegative:
                n = -b.WindCnt;
                break;
              default:
                n = Math.abs(b.WindCnt);
            }
            if (g && h) f || e || 0 !== k2 && 1 != k2 || 0 !== n && 1 != n || a.PolyTyp != b.PolyTyp && this.m_ClipType != d.ClipType.ctXor ? this.AddLocalMaxPoly(a, b, c) : (this.AddOutPt(a, c), this.AddOutPt(b, c), d.Clipper.SwapSides(
              a,
              b
            ), d.Clipper.SwapPolyIndexes(a, b));
            else if (g) {
              if (0 === n || 1 == n) this.AddOutPt(a, c), d.Clipper.SwapSides(a, b), d.Clipper.SwapPolyIndexes(a, b);
            } else if (h) {
              if (0 === k2 || 1 == k2) this.AddOutPt(b, c), d.Clipper.SwapSides(a, b), d.Clipper.SwapPolyIndexes(a, b);
            } else if (!(0 !== k2 && 1 != k2 || 0 !== n && 1 != n || f || e)) {
              switch (m2) {
                case d.PolyFillType.pftPositive:
                  g = a.WindCnt2;
                  break;
                case d.PolyFillType.pftNegative:
                  g = -a.WindCnt2;
                  break;
                default:
                  g = Math.abs(a.WindCnt2);
              }
              switch (l) {
                case d.PolyFillType.pftPositive:
                  h = b.WindCnt2;
                  break;
                case d.PolyFillType.pftNegative:
                  h = -b.WindCnt2;
                  break;
                default:
                  h = Math.abs(b.WindCnt2);
              }
              if (a.PolyTyp != b.PolyTyp) this.AddLocalMinPoly(a, b, c);
              else if (1 == k2 && 1 == n) switch (this.m_ClipType) {
                case d.ClipType.ctIntersection:
                  0 < g && 0 < h && this.AddLocalMinPoly(a, b, c);
                  break;
                case d.ClipType.ctUnion:
                  0 >= g && 0 >= h && this.AddLocalMinPoly(a, b, c);
                  break;
                case d.ClipType.ctDifference:
                  (a.PolyTyp == d.PolyType.ptClip && 0 < g && 0 < h || a.PolyTyp == d.PolyType.ptSubject && 0 >= g && 0 >= h) && this.AddLocalMinPoly(a, b, c);
                  break;
                case d.ClipType.ctXor:
                  this.AddLocalMinPoly(a, b, c);
              }
              else d.Clipper.SwapSides(
                a,
                b
              );
            }
            f != e && (f && 0 <= a.OutIdx || e && 0 <= b.OutIdx) && (d.Clipper.SwapSides(a, b), d.Clipper.SwapPolyIndexes(a, b));
            f && this.DeleteFromAEL(a);
            e && this.DeleteFromAEL(b);
          }
        };
        d.Clipper.prototype.DeleteFromAEL = function(a) {
          var b = a.PrevInAEL, c = a.NextInAEL;
          if (null !== b || null !== c || a == this.m_ActiveEdges) null !== b ? b.NextInAEL = c : this.m_ActiveEdges = c, null !== c && (c.PrevInAEL = b), a.NextInAEL = null, a.PrevInAEL = null;
        };
        d.Clipper.prototype.DeleteFromSEL = function(a) {
          var b = a.PrevInSEL, c = a.NextInSEL;
          if (null !== b || null !== c || a == this.m_SortedEdges) null !== b ? b.NextInSEL = c : this.m_SortedEdges = c, null !== c && (c.PrevInSEL = b), a.NextInSEL = null, a.PrevInSEL = null;
        };
        d.Clipper.prototype.UpdateEdgeIntoAEL = function(a) {
          null === a.NextInLML && d.Error("UpdateEdgeIntoAEL: invalid call");
          var b = a.PrevInAEL, c = a.NextInAEL;
          a.NextInLML.OutIdx = a.OutIdx;
          null !== b ? b.NextInAEL = a.NextInLML : this.m_ActiveEdges = a.NextInLML;
          null !== c && (c.PrevInAEL = a.NextInLML);
          a.NextInLML.Side = a.Side;
          a.NextInLML.WindDelta = a.WindDelta;
          a.NextInLML.WindCnt = a.WindCnt;
          a.NextInLML.WindCnt2 = a.WindCnt2;
          a = a.NextInLML;
          a.Curr.X = a.Bot.X;
          a.Curr.Y = a.Bot.Y;
          a.PrevInAEL = b;
          a.NextInAEL = c;
          d.ClipperBase.IsHorizontal(a) || this.InsertScanbeam(a.Top.Y);
          return a;
        };
        d.Clipper.prototype.ProcessHorizontals = function(a) {
          for (var b = this.m_SortedEdges; null !== b; ) this.DeleteFromSEL(b), this.ProcessHorizontal(b, a), b = this.m_SortedEdges;
        };
        d.Clipper.prototype.GetHorzDirection = function(a, b) {
          a.Bot.X < a.Top.X ? (b.Left = a.Bot.X, b.Right = a.Top.X, b.Dir = d.Direction.dLeftToRight) : (b.Left = a.Top.X, b.Right = a.Bot.X, b.Dir = d.Direction.dRightToLeft);
        };
        d.Clipper.prototype.PrepareHorzJoins = function(a, b) {
          var c = this.m_PolyOuts[a.OutIdx].Pts;
          a.Side != d.EdgeSide.esLeft && (c = c.Prev);
          b && (d.IntPoint.op_Equality(c.Pt, a.Top) ? this.AddGhostJoin(c, a.Bot) : this.AddGhostJoin(c, a.Top));
        };
        d.Clipper.prototype.ProcessHorizontal = function(a, b) {
          var c = { Dir: null, Left: null, Right: null };
          this.GetHorzDirection(a, c);
          for (var e = c.Dir, f = c.Left, g = c.Right, h = a, l = null; null !== h.NextInLML && d.ClipperBase.IsHorizontal(h.NextInLML); ) h = h.NextInLML;
          for (null === h.NextInLML && (l = this.GetMaximaPair(h)); ; ) {
            for (var k2 = a == h, n = this.GetNextInAEL(
              a,
              e
            ); null !== n && !(n.Curr.X == a.Top.X && null !== a.NextInLML && n.Dx < a.NextInLML.Dx); ) {
              c = this.GetNextInAEL(n, e);
              if (e == d.Direction.dLeftToRight && n.Curr.X <= g || e == d.Direction.dRightToLeft && n.Curr.X >= f) {
                0 <= a.OutIdx && 0 != a.WindDelta && this.PrepareHorzJoins(a, b);
                if (n == l && k2) {
                  e == d.Direction.dLeftToRight ? this.IntersectEdges(a, n, n.Top, false) : this.IntersectEdges(n, a, n.Top, false);
                  0 <= l.OutIdx && d.Error("ProcessHorizontal error");
                  return;
                }
                if (e == d.Direction.dLeftToRight) {
                  var m2 = new d.IntPoint(n.Curr.X, a.Curr.Y);
                  this.IntersectEdges(
                    a,
                    n,
                    m2,
                    true
                  );
                } else m2 = new d.IntPoint(n.Curr.X, a.Curr.Y), this.IntersectEdges(n, a, m2, true);
                this.SwapPositionsInAEL(a, n);
              } else if (e == d.Direction.dLeftToRight && n.Curr.X >= g || e == d.Direction.dRightToLeft && n.Curr.X <= f) break;
              n = c;
            }
            0 <= a.OutIdx && 0 !== a.WindDelta && this.PrepareHorzJoins(a, b);
            if (null !== a.NextInLML && d.ClipperBase.IsHorizontal(a.NextInLML)) a = this.UpdateEdgeIntoAEL(a), 0 <= a.OutIdx && this.AddOutPt(a, a.Bot), c = { Dir: e, Left: f, Right: g }, this.GetHorzDirection(a, c), e = c.Dir, f = c.Left, g = c.Right;
            else break;
          }
          null !== a.NextInLML ? 0 <= a.OutIdx ? (e = this.AddOutPt(a, a.Top), a = this.UpdateEdgeIntoAEL(a), 0 !== a.WindDelta && (f = a.PrevInAEL, c = a.NextInAEL, null !== f && f.Curr.X == a.Bot.X && f.Curr.Y == a.Bot.Y && 0 !== f.WindDelta && 0 <= f.OutIdx && f.Curr.Y > f.Top.Y && d.ClipperBase.SlopesEqual(a, f, this.m_UseFullRange) ? (c = this.AddOutPt(f, a.Bot), this.AddJoin(e, c, a.Top)) : null !== c && c.Curr.X == a.Bot.X && c.Curr.Y == a.Bot.Y && 0 !== c.WindDelta && 0 <= c.OutIdx && c.Curr.Y > c.Top.Y && d.ClipperBase.SlopesEqual(a, c, this.m_UseFullRange) && (c = this.AddOutPt(c, a.Bot), this.AddJoin(
            e,
            c,
            a.Top
          )))) : this.UpdateEdgeIntoAEL(a) : null !== l ? 0 <= l.OutIdx ? (e == d.Direction.dLeftToRight ? this.IntersectEdges(a, l, a.Top, false) : this.IntersectEdges(l, a, a.Top, false), 0 <= l.OutIdx && d.Error("ProcessHorizontal error")) : (this.DeleteFromAEL(a), this.DeleteFromAEL(l)) : (0 <= a.OutIdx && this.AddOutPt(a, a.Top), this.DeleteFromAEL(a));
        };
        d.Clipper.prototype.GetNextInAEL = function(a, b) {
          return b == d.Direction.dLeftToRight ? a.NextInAEL : a.PrevInAEL;
        };
        d.Clipper.prototype.IsMinima = function(a) {
          return null !== a && a.Prev.NextInLML != a && a.Next.NextInLML != a;
        };
        d.Clipper.prototype.IsMaxima = function(a, b) {
          return null !== a && a.Top.Y == b && null === a.NextInLML;
        };
        d.Clipper.prototype.IsIntermediate = function(a, b) {
          return a.Top.Y == b && null !== a.NextInLML;
        };
        d.Clipper.prototype.GetMaximaPair = function(a) {
          var b = null;
          d.IntPoint.op_Equality(a.Next.Top, a.Top) && null === a.Next.NextInLML ? b = a.Next : d.IntPoint.op_Equality(a.Prev.Top, a.Top) && null === a.Prev.NextInLML && (b = a.Prev);
          return null === b || -2 != b.OutIdx && (b.NextInAEL != b.PrevInAEL || d.ClipperBase.IsHorizontal(b)) ? b : null;
        };
        d.Clipper.prototype.ProcessIntersections = function(a, b) {
          if (null == this.m_ActiveEdges) return true;
          try {
            this.BuildIntersectList(a, b);
            if (0 == this.m_IntersectList.length) return true;
            if (1 == this.m_IntersectList.length || this.FixupIntersectionOrder()) this.ProcessIntersectList();
            else return false;
          } catch (c) {
            this.m_SortedEdges = null, this.m_IntersectList.length = 0, d.Error("ProcessIntersections error");
          }
          this.m_SortedEdges = null;
          return true;
        };
        d.Clipper.prototype.BuildIntersectList = function(a, b) {
          if (null !== this.m_ActiveEdges) {
            var c = this.m_ActiveEdges;
            for (this.m_SortedEdges = c; null !== c; ) c.PrevInSEL = c.PrevInAEL, c.NextInSEL = c.NextInAEL, c.Curr.X = d.Clipper.TopX(c, b), c = c.NextInAEL;
            for (var e = true; e && null !== this.m_SortedEdges; ) {
              e = false;
              for (c = this.m_SortedEdges; null !== c.NextInSEL; ) {
                var f = c.NextInSEL, g = new d.IntPoint();
                c.Curr.X > f.Curr.X ? (!this.IntersectPoint(c, f, g) && c.Curr.X > f.Curr.X + 1 && d.Error("Intersection error"), g.Y > a && (g.Y = a, Math.abs(c.Dx) > Math.abs(f.Dx) ? g.X = d.Clipper.TopX(f, a) : g.X = d.Clipper.TopX(c, a)), e = new d.IntersectNode(), e.Edge1 = c, e.Edge2 = f, e.Pt.X = g.X, e.Pt.Y = g.Y, this.m_IntersectList.push(e), this.SwapPositionsInSEL(c, f), e = true) : c = f;
              }
              if (null !== c.PrevInSEL) c.PrevInSEL.NextInSEL = null;
              else break;
            }
            this.m_SortedEdges = null;
          }
        };
        d.Clipper.prototype.EdgesAdjacent = function(a) {
          return a.Edge1.NextInSEL == a.Edge2 || a.Edge1.PrevInSEL == a.Edge2;
        };
        d.Clipper.IntersectNodeSort = function(a, b) {
          return b.Pt.Y - a.Pt.Y;
        };
        d.Clipper.prototype.FixupIntersectionOrder = function() {
          this.m_IntersectList.sort(this.m_IntersectNodeComparer);
          this.CopyAELToSEL();
          for (var a = this.m_IntersectList.length, b = 0; b < a; b++) {
            if (!this.EdgesAdjacent(this.m_IntersectList[b])) {
              for (var c = b + 1; c < a && !this.EdgesAdjacent(this.m_IntersectList[c]); ) c++;
              if (c == a) return false;
              var e = this.m_IntersectList[b];
              this.m_IntersectList[b] = this.m_IntersectList[c];
              this.m_IntersectList[c] = e;
            }
            this.SwapPositionsInSEL(this.m_IntersectList[b].Edge1, this.m_IntersectList[b].Edge2);
          }
          return true;
        };
        d.Clipper.prototype.ProcessIntersectList = function() {
          for (var a = 0, b = this.m_IntersectList.length; a < b; a++) {
            var c = this.m_IntersectList[a];
            this.IntersectEdges(c.Edge1, c.Edge2, c.Pt, true);
            this.SwapPositionsInAEL(c.Edge1, c.Edge2);
          }
          this.m_IntersectList.length = 0;
        };
        E = function(a) {
          return 0 > a ? Math.ceil(a - 0.5) : Math.round(a);
        };
        F = function(a) {
          return 0 > a ? Math.ceil(a - 0.5) : Math.floor(a + 0.5);
        };
        G = function(a) {
          return 0 > a ? -Math.round(Math.abs(a)) : Math.round(a);
        };
        H = function(a) {
          if (0 > a) return a -= 0.5, -2147483648 > a ? Math.ceil(a) : a | 0;
          a += 0.5;
          return 2147483647 < a ? Math.floor(a) : a | 0;
        };
        d.Clipper.Round = p ? E : D ? G : J ? H : F;
        d.Clipper.TopX = function(a, b) {
          return b == a.Top.Y ? a.Top.X : a.Bot.X + d.Clipper.Round(a.Dx * (b - a.Bot.Y));
        };
        d.Clipper.prototype.IntersectPoint = function(a, b, c) {
          c.X = 0;
          c.Y = 0;
          var e, f;
          if (d.ClipperBase.SlopesEqual(
            a,
            b,
            this.m_UseFullRange
          ) || a.Dx == b.Dx) return b.Bot.Y > a.Bot.Y ? (c.X = b.Bot.X, c.Y = b.Bot.Y) : (c.X = a.Bot.X, c.Y = a.Bot.Y), false;
          if (0 === a.Delta.X) c.X = a.Bot.X, d.ClipperBase.IsHorizontal(b) ? c.Y = b.Bot.Y : (f = b.Bot.Y - b.Bot.X / b.Dx, c.Y = d.Clipper.Round(c.X / b.Dx + f));
          else if (0 === b.Delta.X) c.X = b.Bot.X, d.ClipperBase.IsHorizontal(a) ? c.Y = a.Bot.Y : (e = a.Bot.Y - a.Bot.X / a.Dx, c.Y = d.Clipper.Round(c.X / a.Dx + e));
          else {
            e = a.Bot.X - a.Bot.Y * a.Dx;
            f = b.Bot.X - b.Bot.Y * b.Dx;
            var g = (f - e) / (a.Dx - b.Dx);
            c.Y = d.Clipper.Round(g);
            Math.abs(a.Dx) < Math.abs(b.Dx) ? c.X = d.Clipper.Round(a.Dx * g + e) : c.X = d.Clipper.Round(b.Dx * g + f);
          }
          if (c.Y < a.Top.Y || c.Y < b.Top.Y) {
            if (a.Top.Y > b.Top.Y) return c.Y = a.Top.Y, c.X = d.Clipper.TopX(b, a.Top.Y), c.X < a.Top.X;
            c.Y = b.Top.Y;
            Math.abs(a.Dx) < Math.abs(b.Dx) ? c.X = d.Clipper.TopX(a, c.Y) : c.X = d.Clipper.TopX(b, c.Y);
          }
          return true;
        };
        d.Clipper.prototype.ProcessEdgesAtTopOfScanbeam = function(a) {
          for (var b = this.m_ActiveEdges; null !== b; ) {
            var c = this.IsMaxima(b, a);
            c && (c = this.GetMaximaPair(b), c = null === c || !d.ClipperBase.IsHorizontal(c));
            if (c) {
              var e = b.PrevInAEL;
              this.DoMaxima(b);
              b = null === e ? this.m_ActiveEdges : e.NextInAEL;
            } else this.IsIntermediate(b, a) && d.ClipperBase.IsHorizontal(b.NextInLML) ? (b = this.UpdateEdgeIntoAEL(b), 0 <= b.OutIdx && this.AddOutPt(b, b.Bot), this.AddEdgeToSEL(b)) : (b.Curr.X = d.Clipper.TopX(b, a), b.Curr.Y = a), this.StrictlySimple && (e = b.PrevInAEL, 0 <= b.OutIdx && 0 !== b.WindDelta && null !== e && 0 <= e.OutIdx && e.Curr.X == b.Curr.X && 0 !== e.WindDelta && (c = this.AddOutPt(e, b.Curr), e = this.AddOutPt(b, b.Curr), this.AddJoin(c, e, b.Curr))), b = b.NextInAEL;
          }
          this.ProcessHorizontals(true);
          for (b = this.m_ActiveEdges; null !== b; ) {
            if (this.IsIntermediate(b, a)) {
              c = null;
              0 <= b.OutIdx && (c = this.AddOutPt(b, b.Top));
              var b = this.UpdateEdgeIntoAEL(b), e = b.PrevInAEL, f = b.NextInAEL;
              null !== e && e.Curr.X == b.Bot.X && e.Curr.Y == b.Bot.Y && null !== c && 0 <= e.OutIdx && e.Curr.Y > e.Top.Y && d.ClipperBase.SlopesEqual(b, e, this.m_UseFullRange) && 0 !== b.WindDelta && 0 !== e.WindDelta ? (e = this.AddOutPt(e, b.Bot), this.AddJoin(c, e, b.Top)) : null !== f && f.Curr.X == b.Bot.X && f.Curr.Y == b.Bot.Y && null !== c && 0 <= f.OutIdx && f.Curr.Y > f.Top.Y && d.ClipperBase.SlopesEqual(b, f, this.m_UseFullRange) && 0 !== b.WindDelta && 0 !== f.WindDelta && (e = this.AddOutPt(f, b.Bot), this.AddJoin(c, e, b.Top));
            }
            b = b.NextInAEL;
          }
        };
        d.Clipper.prototype.DoMaxima = function(a) {
          var b = this.GetMaximaPair(a);
          if (null === b) 0 <= a.OutIdx && this.AddOutPt(a, a.Top), this.DeleteFromAEL(a);
          else {
            for (var c = a.NextInAEL; null !== c && c != b; ) this.IntersectEdges(a, c, a.Top, true), this.SwapPositionsInAEL(a, c), c = a.NextInAEL;
            -1 == a.OutIdx && -1 == b.OutIdx ? (this.DeleteFromAEL(a), this.DeleteFromAEL(b)) : 0 <= a.OutIdx && 0 <= b.OutIdx ? this.IntersectEdges(a, b, a.Top, false) : 0 === a.WindDelta ? (0 <= a.OutIdx && (this.AddOutPt(a, a.Top), a.OutIdx = -1), this.DeleteFromAEL(a), 0 <= b.OutIdx && (this.AddOutPt(b, a.Top), b.OutIdx = -1), this.DeleteFromAEL(b)) : d.Error("DoMaxima error");
          }
        };
        d.Clipper.ReversePaths = function(a) {
          for (var b = 0, c = a.length; b < c; b++) a[b].reverse();
        };
        d.Clipper.Orientation = function(a) {
          return 0 <= d.Clipper.Area(a);
        };
        d.Clipper.prototype.PointCount = function(a) {
          if (null === a) return 0;
          var b = 0, c = a;
          do
            b++, c = c.Next;
          while (c != a);
          return b;
        };
        d.Clipper.prototype.BuildResult = function(a) {
          d.Clear(a);
          for (var b = 0, c = this.m_PolyOuts.length; b < c; b++) {
            var e = this.m_PolyOuts[b];
            if (null !== e.Pts) {
              var e = e.Pts.Prev, f = this.PointCount(e);
              if (!(2 > f)) {
                for (var g = Array(f), h = 0; h < f; h++) g[h] = e.Pt, e = e.Prev;
                a.push(g);
              }
            }
          }
        };
        d.Clipper.prototype.BuildResult2 = function(a) {
          a.Clear();
          for (var b = 0, c = this.m_PolyOuts.length; b < c; b++) {
            var e = this.m_PolyOuts[b], f = this.PointCount(e.Pts);
            if (!(e.IsOpen && 2 > f || !e.IsOpen && 3 > f)) {
              this.FixHoleLinkage(e);
              var g = new d.PolyNode();
              a.m_AllPolys.push(g);
              e.PolyNode = g;
              g.m_polygon.length = f;
              for (var e = e.Pts.Prev, h = 0; h < f; h++) g.m_polygon[h] = e.Pt, e = e.Prev;
            }
          }
          b = 0;
          for (c = this.m_PolyOuts.length; b < c; b++) e = this.m_PolyOuts[b], null !== e.PolyNode && (e.IsOpen ? (e.PolyNode.IsOpen = true, a.AddChild(e.PolyNode)) : null !== e.FirstLeft && null != e.FirstLeft.PolyNode ? e.FirstLeft.PolyNode.AddChild(e.PolyNode) : a.AddChild(e.PolyNode));
        };
        d.Clipper.prototype.FixupOutPolygon = function(a) {
          var b = null;
          a.BottomPt = null;
          for (var c = a.Pts; ; ) {
            if (c.Prev == c || c.Prev == c.Next) {
              this.DisposeOutPts(c);
              a.Pts = null;
              return;
            }
            if (d.IntPoint.op_Equality(c.Pt, c.Next.Pt) || d.IntPoint.op_Equality(
              c.Pt,
              c.Prev.Pt
            ) || d.ClipperBase.SlopesEqual(c.Prev.Pt, c.Pt, c.Next.Pt, this.m_UseFullRange) && (!this.PreserveCollinear || !this.Pt2IsBetweenPt1AndPt3(c.Prev.Pt, c.Pt, c.Next.Pt))) b = null, c.Prev.Next = c.Next, c = c.Next.Prev = c.Prev;
            else if (c == b) break;
            else null === b && (b = c), c = c.Next;
          }
          a.Pts = c;
        };
        d.Clipper.prototype.DupOutPt = function(a, b) {
          var c = new d.OutPt();
          c.Pt.X = a.Pt.X;
          c.Pt.Y = a.Pt.Y;
          c.Idx = a.Idx;
          b ? (c.Next = a.Next, c.Prev = a, a.Next.Prev = c, a.Next = c) : (c.Prev = a.Prev, c.Next = a, a.Prev.Next = c, a.Prev = c);
          return c;
        };
        d.Clipper.prototype.GetOverlap = function(a, b, c, e, d2) {
          a < b ? c < e ? (d2.Left = Math.max(a, c), d2.Right = Math.min(b, e)) : (d2.Left = Math.max(a, e), d2.Right = Math.min(b, c)) : c < e ? (d2.Left = Math.max(b, c), d2.Right = Math.min(a, e)) : (d2.Left = Math.max(b, e), d2.Right = Math.min(a, c));
          return d2.Left < d2.Right;
        };
        d.Clipper.prototype.JoinHorz = function(a, b, c, e, f, g) {
          var h = a.Pt.X > b.Pt.X ? d.Direction.dRightToLeft : d.Direction.dLeftToRight;
          e = c.Pt.X > e.Pt.X ? d.Direction.dRightToLeft : d.Direction.dLeftToRight;
          if (h == e) return false;
          if (h == d.Direction.dLeftToRight) {
            for (; a.Next.Pt.X <= f.X && a.Next.Pt.X >= a.Pt.X && a.Next.Pt.Y == f.Y; ) a = a.Next;
            g && a.Pt.X != f.X && (a = a.Next);
            b = this.DupOutPt(a, !g);
            d.IntPoint.op_Inequality(b.Pt, f) && (a = b, a.Pt.X = f.X, a.Pt.Y = f.Y, b = this.DupOutPt(a, !g));
          } else {
            for (; a.Next.Pt.X >= f.X && a.Next.Pt.X <= a.Pt.X && a.Next.Pt.Y == f.Y; ) a = a.Next;
            g || a.Pt.X == f.X || (a = a.Next);
            b = this.DupOutPt(a, g);
            d.IntPoint.op_Inequality(b.Pt, f) && (a = b, a.Pt.X = f.X, a.Pt.Y = f.Y, b = this.DupOutPt(a, g));
          }
          if (e == d.Direction.dLeftToRight) {
            for (; c.Next.Pt.X <= f.X && c.Next.Pt.X >= c.Pt.X && c.Next.Pt.Y == f.Y; ) c = c.Next;
            g && c.Pt.X != f.X && (c = c.Next);
            e = this.DupOutPt(c, !g);
            d.IntPoint.op_Inequality(e.Pt, f) && (c = e, c.Pt.X = f.X, c.Pt.Y = f.Y, e = this.DupOutPt(c, !g));
          } else {
            for (; c.Next.Pt.X >= f.X && c.Next.Pt.X <= c.Pt.X && c.Next.Pt.Y == f.Y; ) c = c.Next;
            g || c.Pt.X == f.X || (c = c.Next);
            e = this.DupOutPt(c, g);
            d.IntPoint.op_Inequality(e.Pt, f) && (c = e, c.Pt.X = f.X, c.Pt.Y = f.Y, e = this.DupOutPt(c, g));
          }
          h == d.Direction.dLeftToRight == g ? (a.Prev = c, c.Next = a, b.Next = e, e.Prev = b) : (a.Next = c, c.Prev = a, b.Prev = e, e.Next = b);
          return true;
        };
        d.Clipper.prototype.JoinPoints = function(a, b, c) {
          var e = a.OutPt1, f = new d.OutPt(), g = a.OutPt2, h = new d.OutPt();
          if ((h = a.OutPt1.Pt.Y == a.OffPt.Y) && d.IntPoint.op_Equality(a.OffPt, a.OutPt1.Pt) && d.IntPoint.op_Equality(a.OffPt, a.OutPt2.Pt)) {
            for (f = a.OutPt1.Next; f != e && d.IntPoint.op_Equality(f.Pt, a.OffPt); ) f = f.Next;
            f = f.Pt.Y > a.OffPt.Y;
            for (h = a.OutPt2.Next; h != g && d.IntPoint.op_Equality(h.Pt, a.OffPt); ) h = h.Next;
            if (f == h.Pt.Y > a.OffPt.Y) return false;
            f ? (f = this.DupOutPt(e, false), h = this.DupOutPt(g, true), e.Prev = g, g.Next = e, f.Next = h, h.Prev = f) : (f = this.DupOutPt(e, true), h = this.DupOutPt(g, false), e.Next = g, g.Prev = e, f.Prev = h, h.Next = f);
            a.OutPt1 = e;
            a.OutPt2 = f;
            return true;
          }
          if (h) {
            for (f = e; e.Prev.Pt.Y == e.Pt.Y && e.Prev != f && e.Prev != g; ) e = e.Prev;
            for (; f.Next.Pt.Y == f.Pt.Y && f.Next != e && f.Next != g; ) f = f.Next;
            if (f.Next == e || f.Next == g) return false;
            for (h = g; g.Prev.Pt.Y == g.Pt.Y && g.Prev != h && g.Prev != f; ) g = g.Prev;
            for (; h.Next.Pt.Y == h.Pt.Y && h.Next != g && h.Next != e; ) h = h.Next;
            if (h.Next == g || h.Next == e) return false;
            c = { Left: null, Right: null };
            if (!this.GetOverlap(e.Pt.X, f.Pt.X, g.Pt.X, h.Pt.X, c)) return false;
            b = c.Left;
            var l = c.Right;
            c = new d.IntPoint();
            e.Pt.X >= b && e.Pt.X <= l ? (c.X = e.Pt.X, c.Y = e.Pt.Y, b = e.Pt.X > f.Pt.X) : g.Pt.X >= b && g.Pt.X <= l ? (c.X = g.Pt.X, c.Y = g.Pt.Y, b = g.Pt.X > h.Pt.X) : f.Pt.X >= b && f.Pt.X <= l ? (c.X = f.Pt.X, c.Y = f.Pt.Y, b = f.Pt.X > e.Pt.X) : (c.X = h.Pt.X, c.Y = h.Pt.Y, b = h.Pt.X > g.Pt.X);
            a.OutPt1 = e;
            a.OutPt2 = g;
            return this.JoinHorz(e, f, g, h, c, b);
          }
          for (f = e.Next; d.IntPoint.op_Equality(f.Pt, e.Pt) && f != e; ) f = f.Next;
          if (l = f.Pt.Y > e.Pt.Y || !d.ClipperBase.SlopesEqual(e.Pt, f.Pt, a.OffPt, this.m_UseFullRange)) {
            for (f = e.Prev; d.IntPoint.op_Equality(f.Pt, e.Pt) && f != e; ) f = f.Prev;
            if (f.Pt.Y > e.Pt.Y || !d.ClipperBase.SlopesEqual(
              e.Pt,
              f.Pt,
              a.OffPt,
              this.m_UseFullRange
            )) return false;
          }
          for (h = g.Next; d.IntPoint.op_Equality(h.Pt, g.Pt) && h != g; ) h = h.Next;
          var k2 = h.Pt.Y > g.Pt.Y || !d.ClipperBase.SlopesEqual(g.Pt, h.Pt, a.OffPt, this.m_UseFullRange);
          if (k2) {
            for (h = g.Prev; d.IntPoint.op_Equality(h.Pt, g.Pt) && h != g; ) h = h.Prev;
            if (h.Pt.Y > g.Pt.Y || !d.ClipperBase.SlopesEqual(g.Pt, h.Pt, a.OffPt, this.m_UseFullRange)) return false;
          }
          if (f == e || h == g || f == h || b == c && l == k2) return false;
          l ? (f = this.DupOutPt(e, false), h = this.DupOutPt(g, true), e.Prev = g, g.Next = e, f.Next = h, h.Prev = f) : (f = this.DupOutPt(e, true), h = this.DupOutPt(g, false), e.Next = g, g.Prev = e, f.Prev = h, h.Next = f);
          a.OutPt1 = e;
          a.OutPt2 = f;
          return true;
        };
        d.Clipper.GetBounds = function(a) {
          for (var b = 0, c = a.length; b < c && 0 == a[b].length; ) b++;
          if (b == c) return new d.IntRect(0, 0, 0, 0);
          var e = new d.IntRect();
          e.left = a[b][0].X;
          e.right = e.left;
          e.top = a[b][0].Y;
          for (e.bottom = e.top; b < c; b++) for (var f = 0, g = a[b].length; f < g; f++) a[b][f].X < e.left ? e.left = a[b][f].X : a[b][f].X > e.right && (e.right = a[b][f].X), a[b][f].Y < e.top ? e.top = a[b][f].Y : a[b][f].Y > e.bottom && (e.bottom = a[b][f].Y);
          return e;
        };
        d.Clipper.prototype.GetBounds2 = function(a) {
          var b = a, c = new d.IntRect();
          c.left = a.Pt.X;
          c.right = a.Pt.X;
          c.top = a.Pt.Y;
          c.bottom = a.Pt.Y;
          for (a = a.Next; a != b; ) a.Pt.X < c.left && (c.left = a.Pt.X), a.Pt.X > c.right && (c.right = a.Pt.X), a.Pt.Y < c.top && (c.top = a.Pt.Y), a.Pt.Y > c.bottom && (c.bottom = a.Pt.Y), a = a.Next;
          return c;
        };
        d.Clipper.PointInPolygon = function(a, b) {
          var c = 0, e = b.length;
          if (3 > e) return 0;
          for (var d2 = b[0], g = 1; g <= e; ++g) {
            var h = g == e ? b[0] : b[g];
            if (h.Y == a.Y && (h.X == a.X || d2.Y == a.Y && h.X > a.X == d2.X < a.X)) return -1;
            if (d2.Y < a.Y != h.Y < a.Y) {
              if (d2.X >= a.X) if (h.X > a.X) c = 1 - c;
              else {
                var l = (d2.X - a.X) * (h.Y - a.Y) - (h.X - a.X) * (d2.Y - a.Y);
                if (0 == l) return -1;
                0 < l == h.Y > d2.Y && (c = 1 - c);
              }
              else if (h.X > a.X) {
                l = (d2.X - a.X) * (h.Y - a.Y) - (h.X - a.X) * (d2.Y - a.Y);
                if (0 == l) return -1;
                0 < l == h.Y > d2.Y && (c = 1 - c);
              }
            }
            d2 = h;
          }
          return c;
        };
        d.Clipper.prototype.PointInPolygon = function(a, b) {
          for (var c = 0, e = b; ; ) {
            var d2 = b.Pt.X, g = b.Pt.Y, h = b.Next.Pt.X, l = b.Next.Pt.Y;
            if (l == a.Y && (h == a.X || g == a.Y && h > a.X == d2 < a.X)) return -1;
            if (g < a.Y != l < a.Y) {
              if (d2 >= a.X) if (h > a.X) c = 1 - c;
              else {
                d2 = (d2 - a.X) * (l - a.Y) - (h - a.X) * (g - a.Y);
                if (0 == d2) return -1;
                0 < d2 == l > g && (c = 1 - c);
              }
              else if (h > a.X) {
                d2 = (d2 - a.X) * (l - a.Y) - (h - a.X) * (g - a.Y);
                if (0 == d2) return -1;
                0 < d2 == l > g && (c = 1 - c);
              }
            }
            b = b.Next;
            if (e == b) break;
          }
          return c;
        };
        d.Clipper.prototype.Poly2ContainsPoly1 = function(a, b) {
          var c = a;
          do {
            var e = this.PointInPolygon(c.Pt, b);
            if (0 <= e) return 0 != e;
            c = c.Next;
          } while (c != a);
          return true;
        };
        d.Clipper.prototype.FixupFirstLefts1 = function(a, b) {
          for (var c = 0, e = this.m_PolyOuts.length; c < e; c++) {
            var d2 = this.m_PolyOuts[c];
            null !== d2.Pts && d2.FirstLeft == a && this.Poly2ContainsPoly1(d2.Pts, b.Pts) && (d2.FirstLeft = b);
          }
        };
        d.Clipper.prototype.FixupFirstLefts2 = function(a, b) {
          for (var c = 0, e = this.m_PolyOuts, d2 = e.length, g = e[c]; c < d2; c++, g = e[c]) g.FirstLeft == a && (g.FirstLeft = b);
        };
        d.Clipper.ParseFirstLeft = function(a) {
          for (; null != a && null == a.Pts; ) a = a.FirstLeft;
          return a;
        };
        d.Clipper.prototype.JoinCommonEdges = function() {
          for (var a = 0, b = this.m_Joins.length; a < b; a++) {
            var c = this.m_Joins[a], e = this.GetOutRec(c.OutPt1.Idx), f = this.GetOutRec(c.OutPt2.Idx);
            if (null != e.Pts && null != f.Pts) {
              var g;
              g = e == f ? e : this.Param1RightOfParam2(e, f) ? f : this.Param1RightOfParam2(f, e) ? e : this.GetLowermostRec(e, f);
              if (this.JoinPoints(
                c,
                e,
                f
              )) if (e == f) {
                e.Pts = c.OutPt1;
                e.BottomPt = null;
                f = this.CreateOutRec();
                f.Pts = c.OutPt2;
                this.UpdateOutPtIdxs(f);
                if (this.m_UsingPolyTree) {
                  g = 0;
                  for (var h = this.m_PolyOuts.length; g < h - 1; g++) {
                    var l = this.m_PolyOuts[g];
                    null != l.Pts && d.Clipper.ParseFirstLeft(l.FirstLeft) == e && l.IsHole != e.IsHole && this.Poly2ContainsPoly1(l.Pts, c.OutPt2) && (l.FirstLeft = f);
                  }
                }
                this.Poly2ContainsPoly1(f.Pts, e.Pts) ? (f.IsHole = !e.IsHole, f.FirstLeft = e, this.m_UsingPolyTree && this.FixupFirstLefts2(f, e), (f.IsHole ^ this.ReverseSolution) == 0 < this.Area(f) && this.ReversePolyPtLinks(f.Pts)) : this.Poly2ContainsPoly1(e.Pts, f.Pts) ? (f.IsHole = e.IsHole, e.IsHole = !f.IsHole, f.FirstLeft = e.FirstLeft, e.FirstLeft = f, this.m_UsingPolyTree && this.FixupFirstLefts2(e, f), (e.IsHole ^ this.ReverseSolution) == 0 < this.Area(e) && this.ReversePolyPtLinks(e.Pts)) : (f.IsHole = e.IsHole, f.FirstLeft = e.FirstLeft, this.m_UsingPolyTree && this.FixupFirstLefts1(e, f));
              } else f.Pts = null, f.BottomPt = null, f.Idx = e.Idx, e.IsHole = g.IsHole, g == f && (e.FirstLeft = f.FirstLeft), f.FirstLeft = e, this.m_UsingPolyTree && this.FixupFirstLefts2(
                f,
                e
              );
            }
          }
        };
        d.Clipper.prototype.UpdateOutPtIdxs = function(a) {
          var b = a.Pts;
          do
            b.Idx = a.Idx, b = b.Prev;
          while (b != a.Pts);
        };
        d.Clipper.prototype.DoSimplePolygons = function() {
          for (var a = 0; a < this.m_PolyOuts.length; ) {
            var b = this.m_PolyOuts[a++], c = b.Pts;
            if (null !== c) {
              do {
                for (var e = c.Next; e != b.Pts; ) {
                  if (d.IntPoint.op_Equality(c.Pt, e.Pt) && e.Next != c && e.Prev != c) {
                    var f = c.Prev, g = e.Prev;
                    c.Prev = g;
                    g.Next = c;
                    e.Prev = f;
                    f.Next = e;
                    b.Pts = c;
                    f = this.CreateOutRec();
                    f.Pts = e;
                    this.UpdateOutPtIdxs(f);
                    this.Poly2ContainsPoly1(f.Pts, b.Pts) ? (f.IsHole = !b.IsHole, f.FirstLeft = b) : this.Poly2ContainsPoly1(b.Pts, f.Pts) ? (f.IsHole = b.IsHole, b.IsHole = !f.IsHole, f.FirstLeft = b.FirstLeft, b.FirstLeft = f) : (f.IsHole = b.IsHole, f.FirstLeft = b.FirstLeft);
                    e = c;
                  }
                  e = e.Next;
                }
                c = c.Next;
              } while (c != b.Pts);
            }
          }
        };
        d.Clipper.Area = function(a) {
          var b = a.length;
          if (3 > b) return 0;
          for (var c = 0, e = 0, d2 = b - 1; e < b; ++e) c += (a[d2].X + a[e].X) * (a[d2].Y - a[e].Y), d2 = e;
          return 0.5 * -c;
        };
        d.Clipper.prototype.Area = function(a) {
          var b = a.Pts;
          if (null == b) return 0;
          var c = 0;
          do
            c += (b.Prev.Pt.X + b.Pt.X) * (b.Prev.Pt.Y - b.Pt.Y), b = b.Next;
          while (b != a.Pts);
          return 0.5 * c;
        };
        d.Clipper.SimplifyPolygon = function(a, b) {
          var c = [], e = new d.Clipper(0);
          e.StrictlySimple = true;
          e.AddPath(a, d.PolyType.ptSubject, true);
          e.Execute(d.ClipType.ctUnion, c, b, b);
          return c;
        };
        d.Clipper.SimplifyPolygons = function(a, b) {
          "undefined" == typeof b && (b = d.PolyFillType.pftEvenOdd);
          var c = [], e = new d.Clipper(0);
          e.StrictlySimple = true;
          e.AddPaths(a, d.PolyType.ptSubject, true);
          e.Execute(d.ClipType.ctUnion, c, b, b);
          return c;
        };
        d.Clipper.DistanceSqrd = function(a, b) {
          var c = a.X - b.X, e = a.Y - b.Y;
          return c * c + e * e;
        };
        d.Clipper.DistanceFromLineSqrd = function(a, b, c) {
          var e = b.Y - c.Y;
          c = c.X - b.X;
          b = e * b.X + c * b.Y;
          b = e * a.X + c * a.Y - b;
          return b * b / (e * e + c * c);
        };
        d.Clipper.SlopesNearCollinear = function(a, b, c, e) {
          return d.Clipper.DistanceFromLineSqrd(b, a, c) < e;
        };
        d.Clipper.PointsAreClose = function(a, b, c) {
          var e = a.X - b.X;
          a = a.Y - b.Y;
          return e * e + a * a <= c;
        };
        d.Clipper.ExcludeOp = function(a) {
          var b = a.Prev;
          b.Next = a.Next;
          a.Next.Prev = b;
          b.Idx = 0;
          return b;
        };
        d.Clipper.CleanPolygon = function(a, b) {
          "undefined" == typeof b && (b = 1.415);
          var c = a.length;
          if (0 == c) return [];
          for (var e = Array(c), f = 0; f < c; ++f) e[f] = new d.OutPt();
          for (f = 0; f < c; ++f) e[f].Pt = a[f], e[f].Next = e[(f + 1) % c], e[f].Next.Prev = e[f], e[f].Idx = 0;
          f = b * b;
          for (e = e[0]; 0 == e.Idx && e.Next != e.Prev; ) d.Clipper.PointsAreClose(e.Pt, e.Prev.Pt, f) ? (e = d.Clipper.ExcludeOp(e), c--) : d.Clipper.PointsAreClose(e.Prev.Pt, e.Next.Pt, f) ? (d.Clipper.ExcludeOp(e.Next), e = d.Clipper.ExcludeOp(e), c -= 2) : d.Clipper.SlopesNearCollinear(e.Prev.Pt, e.Pt, e.Next.Pt, f) ? (e = d.Clipper.ExcludeOp(e), c--) : (e.Idx = 1, e = e.Next);
          3 > c && (c = 0);
          for (var g = Array(c), f = 0; f < c; ++f) g[f] = new d.IntPoint(e.Pt), e = e.Next;
          return g;
        };
        d.Clipper.CleanPolygons = function(a, b) {
          for (var c = Array(a.length), e = 0, f = a.length; e < f; e++) c[e] = d.Clipper.CleanPolygon(a[e], b);
          return c;
        };
        d.Clipper.Minkowski = function(a, b, c, e) {
          var f = e ? 1 : 0, g = a.length, h = b.length;
          e = [];
          if (c) for (c = 0; c < h; c++) {
            for (var l = Array(g), k2 = 0, n = a.length, m2 = a[k2]; k2 < n; k2++, m2 = a[k2]) l[k2] = new d.IntPoint(b[c].X + m2.X, b[c].Y + m2.Y);
            e.push(l);
          }
          else for (c = 0; c < h; c++) {
            l = Array(g);
            k2 = 0;
            n = a.length;
            for (m2 = a[k2]; k2 < n; k2++, m2 = a[k2]) l[k2] = new d.IntPoint(b[c].X - m2.X, b[c].Y - m2.Y);
            e.push(l);
          }
          a = [];
          for (c = 0; c < h - 1 + f; c++) for (k2 = 0; k2 < g; k2++) b = [], b.push(e[c % h][k2 % g]), b.push(e[(c + 1) % h][k2 % g]), b.push(e[(c + 1) % h][(k2 + 1) % g]), b.push(e[c % h][(k2 + 1) % g]), d.Clipper.Orientation(b) || b.reverse(), a.push(b);
          f = new d.Clipper(0);
          f.AddPaths(a, d.PolyType.ptSubject, true);
          f.Execute(d.ClipType.ctUnion, e, d.PolyFillType.pftNonZero, d.PolyFillType.pftNonZero);
          return e;
        };
        d.Clipper.MinkowskiSum = function() {
          var a = arguments, b = a.length;
          if (3 == b) {
            var c = a[0], e = a[2];
            return d.Clipper.Minkowski(c, a[1], true, e);
          }
          if (4 == b) {
            for (var c = a[0], f = a[1], b = a[2], e = a[3], a = new d.Clipper(), g, h = 0, l = f.length; h < l; ++h) g = d.Clipper.Minkowski(c, f[h], true, e), a.AddPaths(g, d.PolyType.ptSubject, true);
            e && a.AddPaths(f, d.PolyType.ptClip, true);
            c = new d.Paths();
            a.Execute(d.ClipType.ctUnion, c, b, b);
            return c;
          }
        };
        d.Clipper.MinkowskiDiff = function(a, b, c) {
          return d.Clipper.Minkowski(a, b, false, c);
        };
        d.Clipper.PolyTreeToPaths = function(a) {
          var b = [];
          d.Clipper.AddPolyNodeToPaths(a, d.Clipper.NodeType.ntAny, b);
          return b;
        };
        d.Clipper.AddPolyNodeToPaths = function(a, b, c) {
          var e = true;
          switch (b) {
            case d.Clipper.NodeType.ntOpen:
              return;
            case d.Clipper.NodeType.ntClosed:
              e = !a.IsOpen;
          }
          0 < a.m_polygon.length && e && c.push(a.m_polygon);
          e = 0;
          a = a.Childs();
          for (var f = a.length, g = a[e]; e < f; e++, g = a[e]) d.Clipper.AddPolyNodeToPaths(g, b, c);
        };
        d.Clipper.OpenPathsFromPolyTree = function(a) {
          for (var b = new d.Paths(), c = 0, e = a.ChildCount(); c < e; c++) a.Childs()[c].IsOpen && b.push(a.Childs()[c].m_polygon);
          return b;
        };
        d.Clipper.ClosedPathsFromPolyTree = function(a) {
          var b = new d.Paths();
          d.Clipper.AddPolyNodeToPaths(a, d.Clipper.NodeType.ntClosed, b);
          return b;
        };
        K(d.Clipper, d.ClipperBase);
        d.Clipper.NodeType = {
          ntAny: 0,
          ntOpen: 1,
          ntClosed: 2
        };
        d.ClipperOffset = function(a, b) {
          "undefined" == typeof a && (a = 2);
          "undefined" == typeof b && (b = d.ClipperOffset.def_arc_tolerance);
          this.m_destPolys = new d.Paths();
          this.m_srcPoly = new d.Path();
          this.m_destPoly = new d.Path();
          this.m_normals = [];
          this.m_StepsPerRad = this.m_miterLim = this.m_cos = this.m_sin = this.m_sinA = this.m_delta = 0;
          this.m_lowest = new d.IntPoint();
          this.m_polyNodes = new d.PolyNode();
          this.MiterLimit = a;
          this.ArcTolerance = b;
          this.m_lowest.X = -1;
        };
        d.ClipperOffset.two_pi = 6.28318530717959;
        d.ClipperOffset.def_arc_tolerance = 0.25;
        d.ClipperOffset.prototype.Clear = function() {
          d.Clear(this.m_polyNodes.Childs());
          this.m_lowest.X = -1;
        };
        d.ClipperOffset.Round = d.Clipper.Round;
        d.ClipperOffset.prototype.AddPath = function(a, b, c) {
          var e = a.length - 1;
          if (!(0 > e)) {
            var f = new d.PolyNode();
            f.m_jointype = b;
            f.m_endtype = c;
            if (c == d.EndType.etClosedLine || c == d.EndType.etClosedPolygon) for (; 0 < e && d.IntPoint.op_Equality(a[0], a[e]); ) e--;
            f.m_polygon.push(a[0]);
            var g = 0;
            b = 0;
            for (var h = 1; h <= e; h++) d.IntPoint.op_Inequality(f.m_polygon[g], a[h]) && (g++, f.m_polygon.push(a[h]), a[h].Y > f.m_polygon[b].Y || a[h].Y == f.m_polygon[b].Y && a[h].X < f.m_polygon[b].X) && (b = g);
            if (!(c == d.EndType.etClosedPolygon && 2 > g || c != d.EndType.etClosedPolygon && 0 > g) && (this.m_polyNodes.AddChild(f), c == d.EndType.etClosedPolygon)) {
              if (0 > this.m_lowest.X) this.m_lowest = new d.IntPoint(0, b);
              else if (a = this.m_polyNodes.Childs()[this.m_lowest.X].m_polygon[this.m_lowest.Y], f.m_polygon[b].Y > a.Y || f.m_polygon[b].Y == a.Y && f.m_polygon[b].X < a.X) this.m_lowest = new d.IntPoint(this.m_polyNodes.ChildCount() - 1, b);
            }
          }
        };
        d.ClipperOffset.prototype.AddPaths = function(a, b, c) {
          for (var e = 0, d2 = a.length; e < d2; e++) this.AddPath(a[e], b, c);
        };
        d.ClipperOffset.prototype.FixOrientations = function() {
          if (0 <= this.m_lowest.X && !d.Clipper.Orientation(this.m_polyNodes.Childs()[this.m_lowest.X].m_polygon)) for (var a = 0; a < this.m_polyNodes.ChildCount(); a++) {
            var b = this.m_polyNodes.Childs()[a];
            (b.m_endtype == d.EndType.etClosedPolygon || b.m_endtype == d.EndType.etClosedLine && d.Clipper.Orientation(b.m_polygon)) && b.m_polygon.reverse();
          }
          else for (a = 0; a < this.m_polyNodes.ChildCount(); a++) b = this.m_polyNodes.Childs()[a], b.m_endtype != d.EndType.etClosedLine || d.Clipper.Orientation(b.m_polygon) || b.m_polygon.reverse();
        };
        d.ClipperOffset.GetUnitNormal = function(a, b) {
          var c = b.X - a.X, e = b.Y - a.Y;
          if (0 == c && 0 == e) return new d.DoublePoint(0, 0);
          var f = 1 / Math.sqrt(c * c + e * e);
          return new d.DoublePoint(e * f, -(c * f));
        };
        d.ClipperOffset.prototype.DoOffset = function(a) {
          this.m_destPolys = [];
          this.m_delta = a;
          if (d.ClipperBase.near_zero(a)) for (var b = 0; b < this.m_polyNodes.ChildCount(); b++) {
            var c = this.m_polyNodes.Childs()[b];
            c.m_endtype == d.EndType.etClosedPolygon && this.m_destPolys.push(c.m_polygon);
          }
          else {
            this.m_miterLim = 2 < this.MiterLimit ? 2 / (this.MiterLimit * this.MiterLimit) : 0.5;
            var b = 0 >= this.ArcTolerance ? d.ClipperOffset.def_arc_tolerance : this.ArcTolerance > Math.abs(a) * d.ClipperOffset.def_arc_tolerance ? Math.abs(a) * d.ClipperOffset.def_arc_tolerance : this.ArcTolerance, e = 3.14159265358979 / Math.acos(1 - b / Math.abs(a));
            this.m_sin = Math.sin(d.ClipperOffset.two_pi / e);
            this.m_cos = Math.cos(d.ClipperOffset.two_pi / e);
            this.m_StepsPerRad = e / d.ClipperOffset.two_pi;
            0 > a && (this.m_sin = -this.m_sin);
            for (b = 0; b < this.m_polyNodes.ChildCount(); b++) {
              c = this.m_polyNodes.Childs()[b];
              this.m_srcPoly = c.m_polygon;
              var f = this.m_srcPoly.length;
              if (!(0 == f || 0 >= a && (3 > f || c.m_endtype != d.EndType.etClosedPolygon))) {
                this.m_destPoly = [];
                if (1 == f) if (c.m_jointype == d.JoinType.jtRound) for (var c = 1, f = 0, g = 1; g <= e; g++) {
                  this.m_destPoly.push(new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[0].X + c * a), d.ClipperOffset.Round(this.m_srcPoly[0].Y + f * a)));
                  var h = c, c = c * this.m_cos - this.m_sin * f, f = h * this.m_sin + f * this.m_cos;
                }
                else for (f = c = -1, g = 0; 4 > g; ++g) this.m_destPoly.push(new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[0].X + c * a), d.ClipperOffset.Round(this.m_srcPoly[0].Y + f * a))), 0 > c ? c = 1 : 0 > f ? f = 1 : c = -1;
                else {
                  for (g = this.m_normals.length = 0; g < f - 1; g++) this.m_normals.push(d.ClipperOffset.GetUnitNormal(this.m_srcPoly[g], this.m_srcPoly[g + 1]));
                  c.m_endtype == d.EndType.etClosedLine || c.m_endtype == d.EndType.etClosedPolygon ? this.m_normals.push(d.ClipperOffset.GetUnitNormal(this.m_srcPoly[f - 1], this.m_srcPoly[0])) : this.m_normals.push(new d.DoublePoint(this.m_normals[f - 2]));
                  if (c.m_endtype == d.EndType.etClosedPolygon) for (h = f - 1, g = 0; g < f; g++) h = this.OffsetPoint(g, h, c.m_jointype);
                  else if (c.m_endtype == d.EndType.etClosedLine) {
                    h = f - 1;
                    for (g = 0; g < f; g++) h = this.OffsetPoint(g, h, c.m_jointype);
                    this.m_destPolys.push(this.m_destPoly);
                    this.m_destPoly = [];
                    h = this.m_normals[f - 1];
                    for (g = f - 1; 0 < g; g--) this.m_normals[g] = new d.DoublePoint(-this.m_normals[g - 1].X, -this.m_normals[g - 1].Y);
                    this.m_normals[0] = new d.DoublePoint(-h.X, -h.Y);
                    h = 0;
                    for (g = f - 1; 0 <= g; g--) h = this.OffsetPoint(g, h, c.m_jointype);
                  } else {
                    h = 0;
                    for (g = 1; g < f - 1; ++g) h = this.OffsetPoint(g, h, c.m_jointype);
                    c.m_endtype == d.EndType.etOpenButt ? (g = f - 1, h = new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[g].X + this.m_normals[g].X * a), d.ClipperOffset.Round(this.m_srcPoly[g].Y + this.m_normals[g].Y * a)), this.m_destPoly.push(h), h = new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[g].X - this.m_normals[g].X * a), d.ClipperOffset.Round(this.m_srcPoly[g].Y - this.m_normals[g].Y * a)), this.m_destPoly.push(h)) : (g = f - 1, h = f - 2, this.m_sinA = 0, this.m_normals[g] = new d.DoublePoint(
                      -this.m_normals[g].X,
                      -this.m_normals[g].Y
                    ), c.m_endtype == d.EndType.etOpenSquare ? this.DoSquare(g, h) : this.DoRound(g, h));
                    for (g = f - 1; 0 < g; g--) this.m_normals[g] = new d.DoublePoint(-this.m_normals[g - 1].X, -this.m_normals[g - 1].Y);
                    this.m_normals[0] = new d.DoublePoint(-this.m_normals[1].X, -this.m_normals[1].Y);
                    h = f - 1;
                    for (g = h - 1; 0 < g; --g) h = this.OffsetPoint(g, h, c.m_jointype);
                    c.m_endtype == d.EndType.etOpenButt ? (h = new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[0].X - this.m_normals[0].X * a), d.ClipperOffset.Round(this.m_srcPoly[0].Y - this.m_normals[0].Y * a)), this.m_destPoly.push(h), h = new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[0].X + this.m_normals[0].X * a), d.ClipperOffset.Round(this.m_srcPoly[0].Y + this.m_normals[0].Y * a)), this.m_destPoly.push(h)) : (this.m_sinA = 0, c.m_endtype == d.EndType.etOpenSquare ? this.DoSquare(0, 1) : this.DoRound(0, 1));
                  }
                }
                this.m_destPolys.push(this.m_destPoly);
              }
            }
          }
        };
        d.ClipperOffset.prototype.Execute = function() {
          var a = arguments;
          if (a[0] instanceof d.PolyTree) if (b = a[0], c = a[1], b.Clear(), this.FixOrientations(), this.DoOffset(c), a = new d.Clipper(0), a.AddPaths(this.m_destPolys, d.PolyType.ptSubject, true), 0 < c) a.Execute(d.ClipType.ctUnion, b, d.PolyFillType.pftPositive, d.PolyFillType.pftPositive);
          else if (c = d.Clipper.GetBounds(this.m_destPolys), e = new d.Path(), e.push(new d.IntPoint(c.left - 10, c.bottom + 10)), e.push(new d.IntPoint(c.right + 10, c.bottom + 10)), e.push(new d.IntPoint(c.right + 10, c.top - 10)), e.push(new d.IntPoint(c.left - 10, c.top - 10)), a.AddPath(e, d.PolyType.ptSubject, true), a.ReverseSolution = true, a.Execute(d.ClipType.ctUnion, b, d.PolyFillType.pftNegative, d.PolyFillType.pftNegative), 1 == b.ChildCount() && 0 < b.Childs()[0].ChildCount()) for (a = b.Childs()[0], b.Childs()[0] = a.Childs()[0], c = 1; c < a.ChildCount(); c++) b.AddChild(a.Childs()[c]);
          else b.Clear();
          else {
            var b = a[0], c = a[1];
            d.Clear(b);
            this.FixOrientations();
            this.DoOffset(c);
            a = new d.Clipper(0);
            a.AddPaths(this.m_destPolys, d.PolyType.ptSubject, true);
            if (0 < c) a.Execute(d.ClipType.ctUnion, b, d.PolyFillType.pftPositive, d.PolyFillType.pftPositive);
            else {
              var c = d.Clipper.GetBounds(this.m_destPolys), e = new d.Path();
              e.push(new d.IntPoint(c.left - 10, c.bottom + 10));
              e.push(new d.IntPoint(c.right + 10, c.bottom + 10));
              e.push(new d.IntPoint(c.right + 10, c.top - 10));
              e.push(new d.IntPoint(c.left - 10, c.top - 10));
              a.AddPath(e, d.PolyType.ptSubject, true);
              a.ReverseSolution = true;
              a.Execute(d.ClipType.ctUnion, b, d.PolyFillType.pftNegative, d.PolyFillType.pftNegative);
              0 < b.length && b.splice(0, 1);
            }
          }
        };
        d.ClipperOffset.prototype.OffsetPoint = function(a, b, c) {
          this.m_sinA = this.m_normals[b].X * this.m_normals[a].Y - this.m_normals[a].X * this.m_normals[b].Y;
          if (5e-5 > this.m_sinA && -5e-5 < this.m_sinA) return b;
          1 < this.m_sinA ? this.m_sinA = 1 : -1 > this.m_sinA && (this.m_sinA = -1);
          if (0 > this.m_sinA * this.m_delta) this.m_destPoly.push(new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[a].X + this.m_normals[b].X * this.m_delta), d.ClipperOffset.Round(this.m_srcPoly[a].Y + this.m_normals[b].Y * this.m_delta))), this.m_destPoly.push(new d.IntPoint(this.m_srcPoly[a])), this.m_destPoly.push(new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[a].X + this.m_normals[a].X * this.m_delta), d.ClipperOffset.Round(this.m_srcPoly[a].Y + this.m_normals[a].Y * this.m_delta)));
          else switch (c) {
            case d.JoinType.jtMiter:
              c = 1 + (this.m_normals[a].X * this.m_normals[b].X + this.m_normals[a].Y * this.m_normals[b].Y);
              c >= this.m_miterLim ? this.DoMiter(a, b, c) : this.DoSquare(a, b);
              break;
            case d.JoinType.jtSquare:
              this.DoSquare(a, b);
              break;
            case d.JoinType.jtRound:
              this.DoRound(a, b);
          }
          return a;
        };
        d.ClipperOffset.prototype.DoSquare = function(a, b) {
          var c = Math.tan(Math.atan2(this.m_sinA, this.m_normals[b].X * this.m_normals[a].X + this.m_normals[b].Y * this.m_normals[a].Y) / 4);
          this.m_destPoly.push(new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[a].X + this.m_delta * (this.m_normals[b].X - this.m_normals[b].Y * c)), d.ClipperOffset.Round(this.m_srcPoly[a].Y + this.m_delta * (this.m_normals[b].Y + this.m_normals[b].X * c))));
          this.m_destPoly.push(new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[a].X + this.m_delta * (this.m_normals[a].X + this.m_normals[a].Y * c)), d.ClipperOffset.Round(this.m_srcPoly[a].Y + this.m_delta * (this.m_normals[a].Y - this.m_normals[a].X * c))));
        };
        d.ClipperOffset.prototype.DoMiter = function(a, b, c) {
          c = this.m_delta / c;
          this.m_destPoly.push(new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[a].X + (this.m_normals[b].X + this.m_normals[a].X) * c), d.ClipperOffset.Round(this.m_srcPoly[a].Y + (this.m_normals[b].Y + this.m_normals[a].Y) * c)));
        };
        d.ClipperOffset.prototype.DoRound = function(a, b) {
          for (var c = Math.atan2(this.m_sinA, this.m_normals[b].X * this.m_normals[a].X + this.m_normals[b].Y * this.m_normals[a].Y), c = d.Cast_Int32(d.ClipperOffset.Round(this.m_StepsPerRad * Math.abs(c))), e = this.m_normals[b].X, f = this.m_normals[b].Y, g, h = 0; h < c; ++h) this.m_destPoly.push(new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[a].X + e * this.m_delta), d.ClipperOffset.Round(this.m_srcPoly[a].Y + f * this.m_delta))), g = e, e = e * this.m_cos - this.m_sin * f, f = g * this.m_sin + f * this.m_cos;
          this.m_destPoly.push(new d.IntPoint(d.ClipperOffset.Round(this.m_srcPoly[a].X + this.m_normals[a].X * this.m_delta), d.ClipperOffset.Round(this.m_srcPoly[a].Y + this.m_normals[a].Y * this.m_delta)));
        };
        d.Error = function(a) {
          try {
            throw Error(a);
          } catch (b) {
            alert(b.message);
          }
        };
        d.JS = {};
        d.JS.AreaOfPolygon = function(a, b) {
          b || (b = 1);
          return d.Clipper.Area(a) / (b * b);
        };
        d.JS.AreaOfPolygons = function(a, b) {
          b || (b = 1);
          for (var c = 0, e = 0; e < a.length; e++) c += d.Clipper.Area(a[e]);
          return c / (b * b);
        };
        d.JS.BoundsOfPath = function(a, b) {
          return d.JS.BoundsOfPaths([a], b);
        };
        d.JS.BoundsOfPaths = function(a, b) {
          b || (b = 1);
          var c = d.Clipper.GetBounds(a);
          c.left /= b;
          c.bottom /= b;
          c.right /= b;
          c.top /= b;
          return c;
        };
        d.JS.Clean = function(a, b) {
          if (!(a instanceof Array)) return [];
          var c = a[0] instanceof Array;
          a = d.JS.Clone(a);
          if ("number" != typeof b || null === b) return d.Error("Delta is not a number in Clean()."), a;
          if (0 === a.length || 1 == a.length && 0 === a[0].length || 0 > b) return a;
          c || (a = [a]);
          for (var e = a.length, f, g, h, l, k2, n, m2, p2 = [], q2 = 0; q2 < e; q2++) if (g = a[q2], f = g.length, 0 !== f) if (3 > f) h = g, p2.push(h);
          else {
            h = g;
            l = b * b;
            k2 = g[0];
            for (m2 = n = 1; m2 < f; m2++) (g[m2].X - k2.X) * (g[m2].X - k2.X) + (g[m2].Y - k2.Y) * (g[m2].Y - k2.Y) <= l || (h[n] = g[m2], k2 = g[m2], n++);
            k2 = g[n - 1];
            (g[0].X - k2.X) * (g[0].X - k2.X) + (g[0].Y - k2.Y) * (g[0].Y - k2.Y) <= l && n--;
            n < f && h.splice(n, f - n);
            h.length && p2.push(h);
          }
          !c && p2.length ? p2 = p2[0] : c || 0 !== p2.length ? c && 0 === p2.length && (p2 = [[]]) : p2 = [];
          return p2;
        };
        d.JS.Clone = function(a) {
          if (!(a instanceof Array) || 0 === a.length) return [];
          if (1 == a.length && 0 === a[0].length) return [[]];
          var b = a[0] instanceof Array;
          b || (a = [a]);
          var c = a.length, e, d2, g, h, l = Array(c);
          for (d2 = 0; d2 < c; d2++) {
            e = a[d2].length;
            h = Array(e);
            for (g = 0; g < e; g++) h[g] = { X: a[d2][g].X, Y: a[d2][g].Y };
            l[d2] = h;
          }
          b || (l = l[0]);
          return l;
        };
        d.JS.Lighten = function(a, b) {
          if (!(a instanceof Array)) return [];
          if ("number" != typeof b || null === b) return d.Error("Tolerance is not a number in Lighten()."), d.JS.Clone(a);
          if (0 === a.length || 1 == a.length && 0 === a[0].length || 0 > b) return d.JS.Clone(a);
          a[0] instanceof Array || (a = [a]);
          var c, e, f, g, h, l, k2, m2, p2, q2, r2, s, t2, u2, v2, x2 = a.length, y2 = b * b, w2 = [];
          for (c = 0; c < x2; c++) if (f = a[c], l = f.length, 0 != l) {
            for (g = 0; 1e6 > g; g++) {
              h = [];
              l = f.length;
              f[l - 1].X != f[0].X || f[l - 1].Y != f[0].Y ? (r2 = 1, f.push({ X: f[0].X, Y: f[0].Y }), l = f.length) : r2 = 0;
              q2 = [];
              for (e = 0; e < l - 2; e++) {
                k2 = f[e];
                p2 = f[e + 1];
                m2 = f[e + 2];
                u2 = k2.X;
                v2 = k2.Y;
                k2 = m2.X - u2;
                s = m2.Y - v2;
                if (0 !== k2 || 0 !== s) t2 = ((p2.X - u2) * k2 + (p2.Y - v2) * s) / (k2 * k2 + s * s), 1 < t2 ? (u2 = m2.X, v2 = m2.Y) : 0 < t2 && (u2 += k2 * t2, v2 += s * t2);
                k2 = p2.X - u2;
                s = p2.Y - v2;
                m2 = k2 * k2 + s * s;
                m2 <= y2 && (q2[e + 1] = 1, e++);
              }
              h.push({ X: f[0].X, Y: f[0].Y });
              for (e = 1; e < l - 1; e++) q2[e] || h.push({ X: f[e].X, Y: f[e].Y });
              h.push({ X: f[l - 1].X, Y: f[l - 1].Y });
              r2 && f.pop();
              if (q2.length) f = h;
              else break;
            }
            l = h.length;
            h[l - 1].X == h[0].X && h[l - 1].Y == h[0].Y && h.pop();
            2 < h.length && w2.push(h);
          }
          !a[0] instanceof Array && (w2 = w2[0]);
          "undefined" == typeof w2 && (w2 = [[]]);
          return w2;
        };
        d.JS.PerimeterOfPath = function(a, b, c) {
          if ("undefined" == typeof a) return 0;
          var e = Math.sqrt, d2 = 0, g, h, k2 = 0, m2 = g = 0;
          h = 0;
          var n = a.length;
          if (2 > n) return 0;
          b && (a[n] = a[0], n++);
          for (; --n; ) g = a[n], k2 = g.X, g = g.Y, h = a[n - 1], m2 = h.X, h = h.Y, d2 += e((k2 - m2) * (k2 - m2) + (g - h) * (g - h));
          b && a.pop();
          return d2 / c;
        };
        d.JS.PerimeterOfPaths = function(a, b, c) {
          c || (c = 1);
          for (var e = 0, f = 0; f < a.length; f++) e += d.JS.PerimeterOfPath(a[f], b, c);
          return e;
        };
        d.JS.ScaleDownPath = function(a, b) {
          var c, d2;
          b || (b = 1);
          for (c = a.length; c--; ) d2 = a[c], d2.X /= b, d2.Y /= b;
        };
        d.JS.ScaleDownPaths = function(a, b) {
          var c, d2, f;
          b || (b = 1);
          for (c = a.length; c--; ) for (d2 = a[c].length; d2--; ) f = a[c][d2], f.X /= b, f.Y /= b;
        };
        d.JS.ScaleUpPath = function(a, b) {
          var c, d2, f = Math.round;
          b || (b = 1);
          for (c = a.length; c--; ) d2 = a[c], d2.X = f(d2.X * b), d2.Y = f(d2.Y * b);
        };
        d.JS.ScaleUpPaths = function(a, b) {
          var c, d2, f, g = Math.round;
          b || (b = 1);
          for (c = a.length; c--; ) for (d2 = a[c].length; d2--; ) f = a[c][d2], f.X = g(f.X * b), f.Y = g(f.Y * b);
        };
        d.ExPolygons = function() {
          return [];
        };
        d.ExPolygon = function() {
          this.holes = this.outer = null;
        };
        d.JS.AddOuterPolyNodeToExPolygons = function(a, b) {
          var c = new d.ExPolygon();
          c.outer = a.Contour();
          var e = a.Childs(), f = e.length;
          c.holes = Array(f);
          var g, h, k2, m2, n;
          for (h = 0; h < f; h++) for (g = e[h], c.holes[h] = g.Contour(), k2 = 0, m2 = g.Childs(), n = m2.length; k2 < n; k2++) g = m2[k2], d.JS.AddOuterPolyNodeToExPolygons(g, b);
          b.push(c);
        };
        d.JS.ExPolygonsToPaths = function(a) {
          var b, c, e, f, g = new d.Paths();
          b = 0;
          for (e = a.length; b < e; b++) for (g.push(a[b].outer), c = 0, f = a[b].holes.length; c < f; c++) g.push(a[b].holes[c]);
          return g;
        };
        d.JS.PolyTreeToExPolygons = function(a) {
          var b = new d.ExPolygons(), c, e, f;
          c = 0;
          e = a.Childs();
          for (f = e.length; c < f; c++) a = e[c], d.JS.AddOuterPolyNodeToExPolygons(a, b);
          return b;
        };
      })();
      return module.exports;
    })();
    var clipper_default = ClipperLib;
    function toClipperCoordinates(polygon) {
      var clone = [];
      for (var i = 0; i < polygon.length; i++) {
        clone.push({
          X: polygon[i].x,
          Y: polygon[i].y
        });
      }
      return clone;
    }
    function toNestCoordinates(polygon, scale) {
      var clone = [];
      for (var i = 0; i < polygon.length; i++) {
        clone.push({
          x: polygon[i].X / scale,
          y: polygon[i].Y / scale
        });
      }
      return clone;
    }
    function rotatePolygon(polygon, degrees) {
      var rotated = [];
      var angle = degrees * Math.PI / 180;
      for (var i = 0; i < polygon.length; i++) {
        var x = polygon[i].x;
        var y = polygon[i].y;
        var x1 = x * Math.cos(angle) - y * Math.sin(angle);
        var y1 = x * Math.sin(angle) + y * Math.cos(angle);
        rotated.push({ x: x1, y: y1 });
      }
      if (polygon.children && polygon.children.length > 0) {
        rotated.children = [];
        for (var j = 0; j < polygon.children.length; j++) {
          rotated.children.push(rotatePolygon(polygon.children[j], degrees));
        }
      }
      return rotated;
    }
    function PlacementWorker(binPolygon, paths, ids, rotations, config, nfpCache) {
      this.binPolygon = binPolygon;
      this.paths = paths;
      this.ids = ids;
      this.rotations = rotations;
      this.config = config;
      this.nfpCache = nfpCache || {};
      this.placePaths = function(paths2) {
        var self2 = this;
        if (!self2.binPolygon) {
          return null;
        }
        var i, j, k, m, n, path;
        var rotated = [];
        for (i = 0; i < paths2.length; i++) {
          var r = rotatePolygon(paths2[i], paths2[i].rotation);
          r.rotation = paths2[i].rotation;
          r.source = paths2[i].source;
          r.id = paths2[i].id;
          rotated.push(r);
        }
        paths2 = rotated;
        var allplacements = [];
        var fitness = 0;
        var binarea = Math.abs(geometryutil_default.polygonArea(self2.binPolygon));
        var key, nfp;
        while (paths2.length > 0) {
          var placed = [];
          var placements = [];
          fitness += 1;
          for (i = 0; i < paths2.length; i++) {
            path = paths2[i];
            key = JSON.stringify({ A: -1, B: path.id, inside: true, Arotation: 0, Brotation: path.rotation });
            var binNfp = self2.nfpCache[key];
            if (!binNfp || binNfp.length == 0) {
              continue;
            }
            var error = false;
            for (j = 0; j < placed.length; j++) {
              key = JSON.stringify({ A: placed[j].id, B: path.id, inside: false, Arotation: placed[j].rotation, Brotation: path.rotation });
              nfp = self2.nfpCache[key];
              if (!nfp) {
                error = true;
                break;
              }
            }
            if (error) {
              continue;
            }
            var position = null;
            if (placed.length == 0) {
              for (j = 0; j < binNfp.length; j++) {
                for (k = 0; k < binNfp[j].length; k++) {
                  if (position === null || binNfp[j][k].x - path[0].x < position.x) {
                    position = {
                      x: binNfp[j][k].x - path[0].x,
                      y: binNfp[j][k].y - path[0].y,
                      id: path.id,
                      rotation: path.rotation
                    };
                  }
                }
              }
              placements.push(position);
              placed.push(path);
              continue;
            }
            var clipperBinNfp = [];
            for (j = 0; j < binNfp.length; j++) {
              clipperBinNfp.push(toClipperCoordinates(binNfp[j]));
            }
            clipper_default.JS.ScaleUpPaths(clipperBinNfp, self2.config.clipperScale);
            var clipper = new clipper_default.Clipper();
            var combinedNfp = new clipper_default.Paths();
            for (j = 0; j < placed.length; j++) {
              key = JSON.stringify({ A: placed[j].id, B: path.id, inside: false, Arotation: placed[j].rotation, Brotation: path.rotation });
              nfp = self2.nfpCache[key];
              if (!nfp) {
                continue;
              }
              for (k = 0; k < nfp.length; k++) {
                var clone = toClipperCoordinates(nfp[k]);
                for (m = 0; m < clone.length; m++) {
                  clone[m].X += placements[j].x;
                  clone[m].Y += placements[j].y;
                }
                clipper_default.JS.ScaleUpPath(clone, self2.config.clipperScale);
                clone = clipper_default.Clipper.CleanPolygon(clone, 1e-4 * self2.config.clipperScale);
                var area = Math.abs(clipper_default.Clipper.Area(clone));
                if (clone.length > 2 && area > 0.1 * self2.config.clipperScale * self2.config.clipperScale) {
                  clipper.AddPath(clone, clipper_default.PolyType.ptSubject, true);
                }
              }
            }
            if (!clipper.Execute(clipper_default.ClipType.ctUnion, combinedNfp, clipper_default.PolyFillType.pftNonZero, clipper_default.PolyFillType.pftNonZero)) {
              continue;
            }
            var finalNfp = new clipper_default.Paths();
            clipper = new clipper_default.Clipper();
            clipper.AddPaths(combinedNfp, clipper_default.PolyType.ptClip, true);
            clipper.AddPaths(clipperBinNfp, clipper_default.PolyType.ptSubject, true);
            if (!clipper.Execute(clipper_default.ClipType.ctDifference, finalNfp, clipper_default.PolyFillType.pftNonZero, clipper_default.PolyFillType.pftNonZero)) {
              continue;
            }
            finalNfp = clipper_default.Clipper.CleanPolygons(finalNfp, 1e-4 * self2.config.clipperScale);
            for (j = 0; j < finalNfp.length; j++) {
              var area = Math.abs(clipper_default.Clipper.Area(finalNfp[j]));
              if (finalNfp[j].length < 3 || area < 0.1 * self2.config.clipperScale * self2.config.clipperScale) {
                finalNfp.splice(j, 1);
                j--;
              }
            }
            if (!finalNfp || finalNfp.length == 0) {
              continue;
            }
            var f = [];
            for (j = 0; j < finalNfp.length; j++) {
              f.push(toNestCoordinates(finalNfp[j], self2.config.clipperScale));
            }
            finalNfp = f;
            var minwidth = null;
            var minarea = null;
            var minx = null;
            var nf, area, shiftvector;
            for (j = 0; j < finalNfp.length; j++) {
              nf = finalNfp[j];
              if (Math.abs(geometryutil_default.polygonArea(nf)) < 2) {
                continue;
              }
              for (k = 0; k < nf.length; k++) {
                var allpoints = [];
                for (m = 0; m < placed.length; m++) {
                  for (n = 0; n < placed[m].length; n++) {
                    allpoints.push({ x: placed[m][n].x + placements[m].x, y: placed[m][n].y + placements[m].y });
                  }
                }
                shiftvector = {
                  x: nf[k].x - path[0].x,
                  y: nf[k].y - path[0].y,
                  id: path.id,
                  rotation: path.rotation,
                  nfp: combinedNfp
                };
                for (m = 0; m < path.length; m++) {
                  allpoints.push({ x: path[m].x + shiftvector.x, y: path[m].y + shiftvector.y });
                }
                var rectbounds = geometryutil_default.getPolygonBounds(allpoints);
                area = rectbounds.width * 2 + rectbounds.height;
                if (minarea === null || area < minarea || geometryutil_default.almostEqual(minarea, area) && (minx === null || shiftvector.x < minx)) {
                  minarea = area;
                  minwidth = rectbounds.width;
                  position = shiftvector;
                  minx = shiftvector.x;
                }
              }
            }
            if (position) {
              placed.push(path);
              placements.push(position);
            }
          }
          if (minwidth) {
            fitness += minwidth / binarea;
          }
          for (i = 0; i < placed.length; i++) {
            var index = paths2.indexOf(placed[i]);
            if (index >= 0) {
              paths2.splice(index, 1);
            }
          }
          if (placements && placements.length > 0) {
            allplacements.push(placements);
          } else {
            break;
          }
        }
        fitness += 2 * paths2.length;
        return { placements: allplacements, fitness, paths: paths2, area: binarea };
      };
    }
    var placementworker_default = PlacementWorker;
    function toClipperCoordinates2(polygon) {
      var clone = [];
      for (var i = 0; i < polygon.length; i++) {
        clone.push({ X: polygon[i].x, Y: polygon[i].y });
      }
      return clone;
    }
    function toNestCoordinates2(polygon, scale) {
      var clone = [];
      for (var i = 0; i < polygon.length; i++) {
        clone.push({ x: polygon[i].X / scale, y: polygon[i].Y / scale });
      }
      return clone;
    }
    function minkowskiDifference(A, B, clipperScale) {
      var Ac = toClipperCoordinates2(A);
      clipper_default.JS.ScaleUpPath(Ac, clipperScale);
      var Bc = toClipperCoordinates2(B);
      clipper_default.JS.ScaleUpPath(Bc, clipperScale);
      for (var i = 0; i < Bc.length; i++) {
        Bc[i].X *= -1;
        Bc[i].Y *= -1;
      }
      var solution = clipper_default.Clipper.MinkowskiSum(Ac, Bc, true);
      var clipperNfp;
      var largestArea = null;
      for (var i = 0; i < solution.length; i++) {
        var n = toNestCoordinates2(solution[i], clipperScale);
        var sarea = geometryutil_default.polygonArea(n);
        if (largestArea === null || largestArea > sarea) {
          clipperNfp = n;
          largestArea = sarea;
        }
      }
      for (var i = 0; i < clipperNfp.length; i++) {
        clipperNfp[i].x += B[0].x;
        clipperNfp[i].y += B[0].y;
      }
      return [clipperNfp];
    }
    self.onmessage = function(e) {
      const { type, pair, config, placelist, ids, rotations, nfpCache, binPolygon } = e.data;
      if (type === "nfp") {
        const { A, B, key } = pair;
        const searchEdges = config.exploreConcave;
        const useHoles = config.useHoles;
        const rotatedA = geometryutil_default.rotatePolygon(A, key.Arotation);
        const rotatedB = geometryutil_default.rotatePolygon(B, key.Brotation);
        let nfp;
        if (key.inside) {
          if (geometryutil_default.isRectangle(rotatedA, 1e-3)) {
            nfp = geometryutil_default.noFitPolygonRectangle(rotatedA, rotatedB);
          } else {
            nfp = geometryutil_default.noFitPolygon(rotatedA, rotatedB, true, searchEdges);
          }
          if (nfp && nfp.length > 0) {
            for (let i = 0; i < nfp.length; i++) {
              if (geometryutil_default.polygonArea(nfp[i]) > 0) nfp[i].reverse();
            }
          }
        } else {
          if (searchEdges) {
            nfp = geometryutil_default.noFitPolygon(rotatedA, rotatedB, false, searchEdges);
          } else {
            nfp = minkowskiDifference(rotatedA, rotatedB, config.clipperScale);
          }
          if (nfp && nfp.length > 0) {
            for (let i = 0; i < nfp.length; i++) {
              if (geometryutil_default.polygonArea(nfp[i]) > 0) nfp[i].reverse();
              if (i > 0 && geometryutil_default.pointInPolygon(nfp[i][0], nfp[0])) {
                if (geometryutil_default.polygonArea(nfp[i]) < 0) nfp[i].reverse();
              }
            }
          }
        }
        self.postMessage({ type: "nfp", key: JSON.stringify(key), value: nfp });
      } else if (type === "place") {
        const worker = new placementworker_default(binPolygon, placelist, ids, rotations, config, nfpCache);
        const result = worker.placePaths(placelist);
        self.postMessage({ type: "place", result });
      }
    };
  })();
})();
