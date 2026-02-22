import{_ as c,g as ae,s as oe,t as ce,q as le,a as ue,b as de,c as nt,d as ht,ar as fe,as as he,at as me,e as ke,R as ye,au as ge,av as P,l as et,aw as ve,ax as Wt,ay as Nt,az as pe,aA as Te,aB as be,aC as xe,aD as we,aE as _e,aF as De,aG as Rt,aH as Bt,aI as zt,aJ as Ht,aK as jt,aL as Se,k as Ce,j as Ee,z as Ie,u as Me}from"./excalidraw-CScENBuD.js";import{d as Ae,a as Fe,b as Le}from"./advancedFormat-CrXTdpSp.js";import{g as $e}from"./react-qkC6yhPU.js";import"./tanstack-Bzt4YlFG.js";var mt={exports:{}},Ye=mt.exports,qt;function Oe(){return qt||(qt=1,(function(t,n){(function(r,i){t.exports=i()})(Ye,(function(){var r,i,a=1e3,g=6e4,x=36e5,M=864e5,$=/\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,R=31536e6,C=2628e6,Y=/^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/,W={years:R,months:C,days:M,hours:x,minutes:g,seconds:a,milliseconds:1,weeks:6048e5},O=function(E){return E instanceof X},L=function(E,p,f){return new X(E,f,p.$l)},_=function(E){return i.p(E)+"s"},J=function(E){return E<0},B=function(E){return J(E)?Math.ceil(E):Math.floor(E)},Q=function(E){return Math.abs(E)},H=function(E,p){return E?J(E)?{negative:!0,format:""+Q(E)+p}:{negative:!1,format:""+E+p}:{negative:!1,format:""}},X=(function(){function E(f,u,k){var y=this;if(this.$d={},this.$l=k,f===void 0&&(this.$ms=0,this.parseFromMilliseconds()),u)return L(f*W[_(u)],this);if(typeof f=="number")return this.$ms=f,this.parseFromMilliseconds(),this;if(typeof f=="object")return Object.keys(f).forEach((function(o){y.$d[_(o)]=f[o]})),this.calMilliseconds(),this;if(typeof f=="string"){var v=f.match(Y);if(v){var m=v.slice(2).map((function(o){return o!=null?Number(o):0}));return this.$d.years=m[0],this.$d.months=m[1],this.$d.weeks=m[2],this.$d.days=m[3],this.$d.hours=m[4],this.$d.minutes=m[5],this.$d.seconds=m[6],this.calMilliseconds(),this}}return this}var p=E.prototype;return p.calMilliseconds=function(){var f=this;this.$ms=Object.keys(this.$d).reduce((function(u,k){return u+(f.$d[k]||0)*W[k]}),0)},p.parseFromMilliseconds=function(){var f=this.$ms;this.$d.years=B(f/R),f%=R,this.$d.months=B(f/C),f%=C,this.$d.days=B(f/M),f%=M,this.$d.hours=B(f/x),f%=x,this.$d.minutes=B(f/g),f%=g,this.$d.seconds=B(f/a),f%=a,this.$d.milliseconds=f},p.toISOString=function(){var f=H(this.$d.years,"Y"),u=H(this.$d.months,"M"),k=+this.$d.days||0;this.$d.weeks&&(k+=7*this.$d.weeks);var y=H(k,"D"),v=H(this.$d.hours,"H"),m=H(this.$d.minutes,"M"),o=this.$d.seconds||0;this.$d.milliseconds&&(o+=this.$d.milliseconds/1e3,o=Math.round(1e3*o)/1e3);var l=H(o,"S"),h=f.negative||u.negative||y.negative||v.negative||m.negative||l.negative,d=v.format||m.format||l.format?"T":"",T=(h?"-":"")+"P"+f.format+u.format+y.format+d+v.format+m.format+l.format;return T==="P"||T==="-P"?"P0D":T},p.toJSON=function(){return this.toISOString()},p.format=function(f){var u=f||"YYYY-MM-DDTHH:mm:ss",k={Y:this.$d.years,YY:i.s(this.$d.years,2,"0"),YYYY:i.s(this.$d.years,4,"0"),M:this.$d.months,MM:i.s(this.$d.months,2,"0"),D:this.$d.days,DD:i.s(this.$d.days,2,"0"),H:this.$d.hours,HH:i.s(this.$d.hours,2,"0"),m:this.$d.minutes,mm:i.s(this.$d.minutes,2,"0"),s:this.$d.seconds,ss:i.s(this.$d.seconds,2,"0"),SSS:i.s(this.$d.milliseconds,3,"0")};return u.replace($,(function(y,v){return v||String(k[y])}))},p.as=function(f){return this.$ms/W[_(f)]},p.get=function(f){var u=this.$ms,k=_(f);return k==="milliseconds"?u%=1e3:u=k==="weeks"?B(u/W[k]):this.$d[k],u||0},p.add=function(f,u,k){var y;return y=u?f*W[_(u)]:O(f)?f.$ms:L(f,this).$ms,L(this.$ms+y*(k?-1:1),this)},p.subtract=function(f,u){return this.add(f,u,!0)},p.locale=function(f){var u=this.clone();return u.$l=f,u},p.clone=function(){return L(this.$ms,this)},p.humanize=function(f){return r().add(this.$ms,"ms").locale(this.$l).fromNow(!f)},p.valueOf=function(){return this.asMilliseconds()},p.milliseconds=function(){return this.get("milliseconds")},p.asMilliseconds=function(){return this.as("milliseconds")},p.seconds=function(){return this.get("seconds")},p.asSeconds=function(){return this.as("seconds")},p.minutes=function(){return this.get("minutes")},p.asMinutes=function(){return this.as("minutes")},p.hours=function(){return this.get("hours")},p.asHours=function(){return this.as("hours")},p.days=function(){return this.get("days")},p.asDays=function(){return this.as("days")},p.weeks=function(){return this.get("weeks")},p.asWeeks=function(){return this.as("weeks")},p.months=function(){return this.get("months")},p.asMonths=function(){return this.as("months")},p.years=function(){return this.get("years")},p.asYears=function(){return this.as("years")},E})(),Z=function(E,p,f){return E.add(p.years()*f,"y").add(p.months()*f,"M").add(p.days()*f,"d").add(p.hours()*f,"h").add(p.minutes()*f,"m").add(p.seconds()*f,"s").add(p.milliseconds()*f,"ms")};return function(E,p,f){r=f,i=f().$utils(),f.duration=function(y,v){var m=f.locale();return L(y,{$l:m},v)},f.isDuration=O;var u=p.prototype.add,k=p.prototype.subtract;p.prototype.add=function(y,v){return O(y)?Z(this,y,1):u.bind(this)(y,v)},p.prototype.subtract=function(y,v){return O(y)?Z(this,y,-1):k.bind(this)(y,v)}}}))})(mt)),mt.exports}var Pe=Oe();const Ve=$e(Pe);var wt=(function(){var t=c(function(m,o,l,h){for(l=l||{},h=m.length;h--;l[m[h]]=o);return l},"o"),n=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],r=[1,26],i=[1,27],a=[1,28],g=[1,29],x=[1,30],M=[1,31],$=[1,32],R=[1,33],C=[1,34],Y=[1,9],W=[1,10],O=[1,11],L=[1,12],_=[1,13],J=[1,14],B=[1,15],Q=[1,16],H=[1,19],X=[1,20],Z=[1,21],E=[1,22],p=[1,23],f=[1,25],u=[1,35],k={trace:c(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:c(function(o,l,h,d,T,s,A){var e=s.length-1;switch(T){case 1:return s[e-1];case 2:this.$=[];break;case 3:s[e-1].push(s[e]),this.$=s[e-1];break;case 4:case 5:this.$=s[e];break;case 6:case 7:this.$=[];break;case 8:d.setWeekday("monday");break;case 9:d.setWeekday("tuesday");break;case 10:d.setWeekday("wednesday");break;case 11:d.setWeekday("thursday");break;case 12:d.setWeekday("friday");break;case 13:d.setWeekday("saturday");break;case 14:d.setWeekday("sunday");break;case 15:d.setWeekend("friday");break;case 16:d.setWeekend("saturday");break;case 17:d.setDateFormat(s[e].substr(11)),this.$=s[e].substr(11);break;case 18:d.enableInclusiveEndDates(),this.$=s[e].substr(18);break;case 19:d.TopAxis(),this.$=s[e].substr(8);break;case 20:d.setAxisFormat(s[e].substr(11)),this.$=s[e].substr(11);break;case 21:d.setTickInterval(s[e].substr(13)),this.$=s[e].substr(13);break;case 22:d.setExcludes(s[e].substr(9)),this.$=s[e].substr(9);break;case 23:d.setIncludes(s[e].substr(9)),this.$=s[e].substr(9);break;case 24:d.setTodayMarker(s[e].substr(12)),this.$=s[e].substr(12);break;case 27:d.setDiagramTitle(s[e].substr(6)),this.$=s[e].substr(6);break;case 28:this.$=s[e].trim(),d.setAccTitle(this.$);break;case 29:case 30:this.$=s[e].trim(),d.setAccDescription(this.$);break;case 31:d.addSection(s[e].substr(8)),this.$=s[e].substr(8);break;case 33:d.addTask(s[e-1],s[e]),this.$="task";break;case 34:this.$=s[e-1],d.setClickEvent(s[e-1],s[e],null);break;case 35:this.$=s[e-2],d.setClickEvent(s[e-2],s[e-1],s[e]);break;case 36:this.$=s[e-2],d.setClickEvent(s[e-2],s[e-1],null),d.setLink(s[e-2],s[e]);break;case 37:this.$=s[e-3],d.setClickEvent(s[e-3],s[e-2],s[e-1]),d.setLink(s[e-3],s[e]);break;case 38:this.$=s[e-2],d.setClickEvent(s[e-2],s[e],null),d.setLink(s[e-2],s[e-1]);break;case 39:this.$=s[e-3],d.setClickEvent(s[e-3],s[e-1],s[e]),d.setLink(s[e-3],s[e-2]);break;case 40:this.$=s[e-1],d.setLink(s[e-1],s[e]);break;case 41:case 47:this.$=s[e-1]+" "+s[e];break;case 42:case 43:case 45:this.$=s[e-2]+" "+s[e-1]+" "+s[e];break;case 44:case 46:this.$=s[e-3]+" "+s[e-2]+" "+s[e-1]+" "+s[e];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(n,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:r,13:i,14:a,15:g,16:x,17:M,18:$,19:18,20:R,21:C,22:Y,23:W,24:O,25:L,26:_,27:J,28:B,29:Q,30:H,31:X,33:Z,35:E,36:p,37:24,38:f,40:u},t(n,[2,7],{1:[2,1]}),t(n,[2,3]),{9:36,11:17,12:r,13:i,14:a,15:g,16:x,17:M,18:$,19:18,20:R,21:C,22:Y,23:W,24:O,25:L,26:_,27:J,28:B,29:Q,30:H,31:X,33:Z,35:E,36:p,37:24,38:f,40:u},t(n,[2,5]),t(n,[2,6]),t(n,[2,17]),t(n,[2,18]),t(n,[2,19]),t(n,[2,20]),t(n,[2,21]),t(n,[2,22]),t(n,[2,23]),t(n,[2,24]),t(n,[2,25]),t(n,[2,26]),t(n,[2,27]),{32:[1,37]},{34:[1,38]},t(n,[2,30]),t(n,[2,31]),t(n,[2,32]),{39:[1,39]},t(n,[2,8]),t(n,[2,9]),t(n,[2,10]),t(n,[2,11]),t(n,[2,12]),t(n,[2,13]),t(n,[2,14]),t(n,[2,15]),t(n,[2,16]),{41:[1,40],43:[1,41]},t(n,[2,4]),t(n,[2,28]),t(n,[2,29]),t(n,[2,33]),t(n,[2,34],{42:[1,42],43:[1,43]}),t(n,[2,40],{41:[1,44]}),t(n,[2,35],{43:[1,45]}),t(n,[2,36]),t(n,[2,38],{42:[1,46]}),t(n,[2,37]),t(n,[2,39])],defaultActions:{},parseError:c(function(o,l){if(l.recoverable)this.trace(o);else{var h=new Error(o);throw h.hash=l,h}},"parseError"),parse:c(function(o){var l=this,h=[0],d=[],T=[null],s=[],A=this.table,e="",b=0,I=0,S=2,D=1,V=s.slice.call(arguments,1),w=Object.create(this.lexer),G={yy:{}};for(var ot in this.yy)Object.prototype.hasOwnProperty.call(this.yy,ot)&&(G.yy[ot]=this.yy[ot]);w.setInput(o,G.yy),G.yy.lexer=w,G.yy.parser=this,typeof w.yylloc>"u"&&(w.yylloc={});var pt=w.yylloc;s.push(pt);var ne=w.options&&w.options.ranges;typeof G.yy.parseError=="function"?this.parseError=G.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function re(z){h.length=h.length-2*z,T.length=T.length-z,s.length=s.length-z}c(re,"popStack");function Pt(){var z;return z=d.pop()||w.lex()||D,typeof z!="number"&&(z instanceof Array&&(d=z,z=d.pop()),z=l.symbols_[z]||z),z}c(Pt,"lex");for(var N,tt,j,Tt,it={},dt,U,Vt,ft;;){if(tt=h[h.length-1],this.defaultActions[tt]?j=this.defaultActions[tt]:((N===null||typeof N>"u")&&(N=Pt()),j=A[tt]&&A[tt][N]),typeof j>"u"||!j.length||!j[0]){var bt="";ft=[];for(dt in A[tt])this.terminals_[dt]&&dt>S&&ft.push("'"+this.terminals_[dt]+"'");w.showPosition?bt="Parse error on line "+(b+1)+`:
`+w.showPosition()+`
Expecting `+ft.join(", ")+", got '"+(this.terminals_[N]||N)+"'":bt="Parse error on line "+(b+1)+": Unexpected "+(N==D?"end of input":"'"+(this.terminals_[N]||N)+"'"),this.parseError(bt,{text:w.match,token:this.terminals_[N]||N,line:w.yylineno,loc:pt,expected:ft})}if(j[0]instanceof Array&&j.length>1)throw new Error("Parse Error: multiple actions possible at state: "+tt+", token: "+N);switch(j[0]){case 1:h.push(N),T.push(w.yytext),s.push(w.yylloc),h.push(j[1]),N=null,I=w.yyleng,e=w.yytext,b=w.yylineno,pt=w.yylloc;break;case 2:if(U=this.productions_[j[1]][1],it.$=T[T.length-U],it._$={first_line:s[s.length-(U||1)].first_line,last_line:s[s.length-1].last_line,first_column:s[s.length-(U||1)].first_column,last_column:s[s.length-1].last_column},ne&&(it._$.range=[s[s.length-(U||1)].range[0],s[s.length-1].range[1]]),Tt=this.performAction.apply(it,[e,I,b,G.yy,j[1],T,s].concat(V)),typeof Tt<"u")return Tt;U&&(h=h.slice(0,-1*U*2),T=T.slice(0,-1*U),s=s.slice(0,-1*U)),h.push(this.productions_[j[1]][0]),T.push(it.$),s.push(it._$),Vt=A[h[h.length-2]][h[h.length-1]],h.push(Vt);break;case 3:return!0}}return!0},"parse")},y=(function(){var m={EOF:1,parseError:c(function(l,h){if(this.yy.parser)this.yy.parser.parseError(l,h);else throw new Error(l)},"parseError"),setInput:c(function(o,l){return this.yy=l||this.yy||{},this._input=o,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:c(function(){var o=this._input[0];this.yytext+=o,this.yyleng++,this.offset++,this.match+=o,this.matched+=o;var l=o.match(/(?:\r\n?|\n).*/g);return l?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),o},"input"),unput:c(function(o){var l=o.length,h=o.split(/(?:\r\n?|\n)/g);this._input=o+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-l),this.offset-=l;var d=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),h.length-1&&(this.yylineno-=h.length-1);var T=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:h?(h.length===d.length?this.yylloc.first_column:0)+d[d.length-h.length].length-h[0].length:this.yylloc.first_column-l},this.options.ranges&&(this.yylloc.range=[T[0],T[0]+this.yyleng-l]),this.yyleng=this.yytext.length,this},"unput"),more:c(function(){return this._more=!0,this},"more"),reject:c(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:c(function(o){this.unput(this.match.slice(o))},"less"),pastInput:c(function(){var o=this.matched.substr(0,this.matched.length-this.match.length);return(o.length>20?"...":"")+o.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:c(function(){var o=this.match;return o.length<20&&(o+=this._input.substr(0,20-o.length)),(o.substr(0,20)+(o.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:c(function(){var o=this.pastInput(),l=new Array(o.length+1).join("-");return o+this.upcomingInput()+`
`+l+"^"},"showPosition"),test_match:c(function(o,l){var h,d,T;if(this.options.backtrack_lexer&&(T={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(T.yylloc.range=this.yylloc.range.slice(0))),d=o[0].match(/(?:\r\n?|\n).*/g),d&&(this.yylineno+=d.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:d?d[d.length-1].length-d[d.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+o[0].length},this.yytext+=o[0],this.match+=o[0],this.matches=o,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(o[0].length),this.matched+=o[0],h=this.performAction.call(this,this.yy,this,l,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),h)return h;if(this._backtrack){for(var s in T)this[s]=T[s];return!1}return!1},"test_match"),next:c(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var o,l,h,d;this._more||(this.yytext="",this.match="");for(var T=this._currentRules(),s=0;s<T.length;s++)if(h=this._input.match(this.rules[T[s]]),h&&(!l||h[0].length>l[0].length)){if(l=h,d=s,this.options.backtrack_lexer){if(o=this.test_match(h,T[s]),o!==!1)return o;if(this._backtrack){l=!1;continue}else return!1}else if(!this.options.flex)break}return l?(o=this.test_match(l,T[d]),o!==!1?o:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:c(function(){var l=this.next();return l||this.lex()},"lex"),begin:c(function(l){this.conditionStack.push(l)},"begin"),popState:c(function(){var l=this.conditionStack.length-1;return l>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:c(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:c(function(l){return l=this.conditionStack.length-1-Math.abs(l||0),l>=0?this.conditionStack[l]:"INITIAL"},"topState"),pushState:c(function(l){this.begin(l)},"pushState"),stateStackSize:c(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:c(function(l,h,d,T){switch(d){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}};return m})();k.lexer=y;function v(){this.yy={}}return c(v,"Parser"),v.prototype=k,k.Parser=v,new v})();wt.parser=wt;var We=wt;P.extend(Ae);P.extend(Fe);P.extend(Le);var Xt={friday:5,saturday:6},q="",Ct="",Et=void 0,It="",ct=[],lt=[],Mt=new Map,At=[],gt=[],at="",Ft="",Kt=["active","done","crit","milestone","vert"],Lt=[],ut=!1,$t=!1,Yt="sunday",vt="saturday",_t=0,Ne=c(function(){At=[],gt=[],at="",Lt=[],kt=0,St=void 0,yt=void 0,F=[],q="",Ct="",Ft="",Et=void 0,It="",ct=[],lt=[],ut=!1,$t=!1,_t=0,Mt=new Map,Ie(),Yt="sunday",vt="saturday"},"clear"),Re=c(function(t){Ct=t},"setAxisFormat"),Be=c(function(){return Ct},"getAxisFormat"),ze=c(function(t){Et=t},"setTickInterval"),He=c(function(){return Et},"getTickInterval"),je=c(function(t){It=t},"setTodayMarker"),qe=c(function(){return It},"getTodayMarker"),Xe=c(function(t){q=t},"setDateFormat"),Ge=c(function(){ut=!0},"enableInclusiveEndDates"),Ue=c(function(){return ut},"endDatesAreInclusive"),Ke=c(function(){$t=!0},"enableTopAxis"),Je=c(function(){return $t},"topAxisEnabled"),Ze=c(function(t){Ft=t},"setDisplayMode"),Qe=c(function(){return Ft},"getDisplayMode"),ts=c(function(){return q},"getDateFormat"),es=c(function(t){ct=t.toLowerCase().split(/[\s,]+/)},"setIncludes"),ss=c(function(){return ct},"getIncludes"),is=c(function(t){lt=t.toLowerCase().split(/[\s,]+/)},"setExcludes"),ns=c(function(){return lt},"getExcludes"),rs=c(function(){return Mt},"getLinks"),as=c(function(t){at=t,At.push(t)},"addSection"),os=c(function(){return At},"getSections"),cs=c(function(){let t=Gt();const n=10;let r=0;for(;!t&&r<n;)t=Gt(),r++;return gt=F,gt},"getTasks"),Jt=c(function(t,n,r,i){const a=t.format(n.trim()),g=t.format("YYYY-MM-DD");return i.includes(a)||i.includes(g)?!1:r.includes("weekends")&&(t.isoWeekday()===Xt[vt]||t.isoWeekday()===Xt[vt]+1)||r.includes(t.format("dddd").toLowerCase())?!0:r.includes(a)||r.includes(g)},"isInvalidDate"),ls=c(function(t){Yt=t},"setWeekday"),us=c(function(){return Yt},"getWeekday"),ds=c(function(t){vt=t},"setWeekend"),Zt=c(function(t,n,r,i){if(!r.length||t.manualEndTime)return;let a;t.startTime instanceof Date?a=P(t.startTime):a=P(t.startTime,n,!0),a=a.add(1,"d");let g;t.endTime instanceof Date?g=P(t.endTime):g=P(t.endTime,n,!0);const[x,M]=fs(a,g,n,r,i);t.endTime=x.toDate(),t.renderEndTime=M},"checkTaskDates"),fs=c(function(t,n,r,i,a){let g=!1,x=null;for(;t<=n;)g||(x=n.toDate()),g=Jt(t,r,i,a),g&&(n=n.add(1,"d")),t=t.add(1,"d");return[n,x]},"fixTaskDates"),Dt=c(function(t,n,r){if(r=r.trim(),c(M=>{const $=M.trim();return $==="x"||$==="X"},"isTimestampFormat")(n)&&/^\d+$/.test(r))return new Date(Number(r));const g=/^after\s+(?<ids>[\d\w- ]+)/.exec(r);if(g!==null){let M=null;for(const R of g.groups.ids.split(" ")){let C=st(R);C!==void 0&&(!M||C.endTime>M.endTime)&&(M=C)}if(M)return M.endTime;const $=new Date;return $.setHours(0,0,0,0),$}let x=P(r,n.trim(),!0);if(x.isValid())return x.toDate();{et.debug("Invalid date:"+r),et.debug("With date format:"+n.trim());const M=new Date(r);if(M===void 0||isNaN(M.getTime())||M.getFullYear()<-1e4||M.getFullYear()>1e4)throw new Error("Invalid date:"+r);return M}},"getStartDate"),Qt=c(function(t){const n=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return n!==null?[Number.parseFloat(n[1]),n[2]]:[NaN,"ms"]},"parseDuration"),te=c(function(t,n,r,i=!1){r=r.trim();const g=/^until\s+(?<ids>[\d\w- ]+)/.exec(r);if(g!==null){let C=null;for(const W of g.groups.ids.split(" ")){let O=st(W);O!==void 0&&(!C||O.startTime<C.startTime)&&(C=O)}if(C)return C.startTime;const Y=new Date;return Y.setHours(0,0,0,0),Y}let x=P(r,n.trim(),!0);if(x.isValid())return i&&(x=x.add(1,"d")),x.toDate();let M=P(t);const[$,R]=Qt(r);if(!Number.isNaN($)){const C=M.add($,R);C.isValid()&&(M=C)}return M.toDate()},"getEndDate"),kt=0,rt=c(function(t){return t===void 0?(kt=kt+1,"task"+kt):t},"parseId"),hs=c(function(t,n){let r;n.substr(0,1)===":"?r=n.substr(1,n.length):r=n;const i=r.split(","),a={};Ot(i,a,Kt);for(let x=0;x<i.length;x++)i[x]=i[x].trim();let g="";switch(i.length){case 1:a.id=rt(),a.startTime=t.endTime,g=i[0];break;case 2:a.id=rt(),a.startTime=Dt(void 0,q,i[0]),g=i[1];break;case 3:a.id=rt(i[0]),a.startTime=Dt(void 0,q,i[1]),g=i[2];break}return g&&(a.endTime=te(a.startTime,q,g,ut),a.manualEndTime=P(g,"YYYY-MM-DD",!0).isValid(),Zt(a,q,lt,ct)),a},"compileData"),ms=c(function(t,n){let r;n.substr(0,1)===":"?r=n.substr(1,n.length):r=n;const i=r.split(","),a={};Ot(i,a,Kt);for(let g=0;g<i.length;g++)i[g]=i[g].trim();switch(i.length){case 1:a.id=rt(),a.startTime={type:"prevTaskEnd",id:t},a.endTime={data:i[0]};break;case 2:a.id=rt(),a.startTime={type:"getStartDate",startData:i[0]},a.endTime={data:i[1]};break;case 3:a.id=rt(i[0]),a.startTime={type:"getStartDate",startData:i[1]},a.endTime={data:i[2]};break}return a},"parseData"),St,yt,F=[],ee={},ks=c(function(t,n){const r={section:at,type:at,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:n},task:t,classes:[]},i=ms(yt,n);r.raw.startTime=i.startTime,r.raw.endTime=i.endTime,r.id=i.id,r.prevTaskId=yt,r.active=i.active,r.done=i.done,r.crit=i.crit,r.milestone=i.milestone,r.vert=i.vert,r.order=_t,_t++;const a=F.push(r);yt=r.id,ee[r.id]=a-1},"addTask"),st=c(function(t){const n=ee[t];return F[n]},"findTaskById"),ys=c(function(t,n){const r={section:at,type:at,description:t,task:t,classes:[]},i=hs(St,n);r.startTime=i.startTime,r.endTime=i.endTime,r.id=i.id,r.active=i.active,r.done=i.done,r.crit=i.crit,r.milestone=i.milestone,r.vert=i.vert,St=r,gt.push(r)},"addTaskOrg"),Gt=c(function(){const t=c(function(r){const i=F[r];let a="";switch(F[r].raw.startTime.type){case"prevTaskEnd":{const g=st(i.prevTaskId);i.startTime=g.endTime;break}case"getStartDate":a=Dt(void 0,q,F[r].raw.startTime.startData),a&&(F[r].startTime=a);break}return F[r].startTime&&(F[r].endTime=te(F[r].startTime,q,F[r].raw.endTime.data,ut),F[r].endTime&&(F[r].processed=!0,F[r].manualEndTime=P(F[r].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),Zt(F[r],q,lt,ct))),F[r].processed},"compileTask");let n=!0;for(const[r,i]of F.entries())t(r),n=n&&i.processed;return n},"compileTasks"),gs=c(function(t,n){let r=n;nt().securityLevel!=="loose"&&(r=Ee.sanitizeUrl(n)),t.split(",").forEach(function(i){st(i)!==void 0&&(ie(i,()=>{window.open(r,"_self")}),Mt.set(i,r))}),se(t,"clickable")},"setLink"),se=c(function(t,n){t.split(",").forEach(function(r){let i=st(r);i!==void 0&&i.classes.push(n)})},"setClass"),vs=c(function(t,n,r){if(nt().securityLevel!=="loose"||n===void 0)return;let i=[];if(typeof r=="string"){i=r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let g=0;g<i.length;g++){let x=i[g].trim();x.startsWith('"')&&x.endsWith('"')&&(x=x.substr(1,x.length-2)),i[g]=x}}i.length===0&&i.push(t),st(t)!==void 0&&ie(t,()=>{Me.runFunc(n,...i)})},"setClickFun"),ie=c(function(t,n){Lt.push(function(){const r=document.querySelector(`[id="${t}"]`);r!==null&&r.addEventListener("click",function(){n()})},function(){const r=document.querySelector(`[id="${t}-text"]`);r!==null&&r.addEventListener("click",function(){n()})})},"pushFun"),ps=c(function(t,n,r){t.split(",").forEach(function(i){vs(i,n,r)}),se(t,"clickable")},"setClickEvent"),Ts=c(function(t){Lt.forEach(function(n){n(t)})},"bindFunctions"),bs={getConfig:c(()=>nt().gantt,"getConfig"),clear:Ne,setDateFormat:Xe,getDateFormat:ts,enableInclusiveEndDates:Ge,endDatesAreInclusive:Ue,enableTopAxis:Ke,topAxisEnabled:Je,setAxisFormat:Re,getAxisFormat:Be,setTickInterval:ze,getTickInterval:He,setTodayMarker:je,getTodayMarker:qe,setAccTitle:de,getAccTitle:ue,setDiagramTitle:le,getDiagramTitle:ce,setDisplayMode:Ze,getDisplayMode:Qe,setAccDescription:oe,getAccDescription:ae,addSection:as,getSections:os,getTasks:cs,addTask:ks,findTaskById:st,addTaskOrg:ys,setIncludes:es,getIncludes:ss,setExcludes:is,getExcludes:ns,setClickEvent:ps,setLink:gs,getLinks:rs,bindFunctions:Ts,parseDuration:Qt,isInvalidDate:Jt,setWeekday:ls,getWeekday:us,setWeekend:ds};function Ot(t,n,r){let i=!0;for(;i;)i=!1,r.forEach(function(a){const g="^\\s*"+a+"\\s*$",x=new RegExp(g);t[0].match(x)&&(n[a]=!0,t.shift(1),i=!0)})}c(Ot,"getTaskTags");P.extend(Ve);var xs=c(function(){et.debug("Something is calling, setConf, remove the call")},"setConf"),Ut={monday:De,tuesday:_e,wednesday:we,thursday:xe,friday:be,saturday:Te,sunday:pe},ws=c((t,n)=>{let r=[...t].map(()=>-1/0),i=[...t].sort((g,x)=>g.startTime-x.startTime||g.order-x.order),a=0;for(const g of i)for(let x=0;x<r.length;x++)if(g.startTime>=r[x]){r[x]=g.endTime,g.order=x+n,x>a&&(a=x);break}return a},"getMaxIntersections"),K,xt=1e4,_s=c(function(t,n,r,i){const a=nt().gantt,g=nt().securityLevel;let x;g==="sandbox"&&(x=ht("#i"+n));const M=g==="sandbox"?ht(x.nodes()[0].contentDocument.body):ht("body"),$=g==="sandbox"?x.nodes()[0].contentDocument:document,R=$.getElementById(n);K=R.parentElement.offsetWidth,K===void 0&&(K=1200),a.useWidth!==void 0&&(K=a.useWidth);const C=i.db.getTasks();let Y=[];for(const u of C)Y.push(u.type);Y=f(Y);const W={};let O=2*a.topPadding;if(i.db.getDisplayMode()==="compact"||a.displayMode==="compact"){const u={};for(const y of C)u[y.section]===void 0?u[y.section]=[y]:u[y.section].push(y);let k=0;for(const y of Object.keys(u)){const v=ws(u[y],k)+1;k+=v,O+=v*(a.barHeight+a.barGap),W[y]=v}}else{O+=C.length*(a.barHeight+a.barGap);for(const u of Y)W[u]=C.filter(k=>k.type===u).length}R.setAttribute("viewBox","0 0 "+K+" "+O);const L=M.select(`[id="${n}"]`),_=fe().domain([he(C,function(u){return u.startTime}),me(C,function(u){return u.endTime})]).rangeRound([0,K-a.leftPadding-a.rightPadding]);function J(u,k){const y=u.startTime,v=k.startTime;let m=0;return y>v?m=1:y<v&&(m=-1),m}c(J,"taskCompare"),C.sort(J),B(C,K,O),ke(L,O,K,a.useMaxWidth),L.append("text").text(i.db.getDiagramTitle()).attr("x",K/2).attr("y",a.titleTopMargin).attr("class","titleText");function B(u,k,y){const v=a.barHeight,m=v+a.barGap,o=a.topPadding,l=a.leftPadding,h=ye().domain([0,Y.length]).range(["#00B9FA","#F95002"]).interpolate(ge);H(m,o,l,k,y,u,i.db.getExcludes(),i.db.getIncludes()),Z(l,o,k,y),Q(u,m,o,l,v,h,k),E(m,o),p(l,o,k,y)}c(B,"makeGantt");function Q(u,k,y,v,m,o,l){u.sort((e,b)=>e.vert===b.vert?0:e.vert?1:-1);const d=[...new Set(u.map(e=>e.order))].map(e=>u.find(b=>b.order===e));L.append("g").selectAll("rect").data(d).enter().append("rect").attr("x",0).attr("y",function(e,b){return b=e.order,b*k+y-2}).attr("width",function(){return l-a.rightPadding/2}).attr("height",k).attr("class",function(e){for(const[b,I]of Y.entries())if(e.type===I)return"section section"+b%a.numberSectionStyles;return"section section0"}).enter();const T=L.append("g").selectAll("rect").data(u).enter(),s=i.db.getLinks();if(T.append("rect").attr("id",function(e){return e.id}).attr("rx",3).attr("ry",3).attr("x",function(e){return e.milestone?_(e.startTime)+v+.5*(_(e.endTime)-_(e.startTime))-.5*m:_(e.startTime)+v}).attr("y",function(e,b){return b=e.order,e.vert?a.gridLineStartPadding:b*k+y}).attr("width",function(e){return e.milestone?m:e.vert?.08*m:_(e.renderEndTime||e.endTime)-_(e.startTime)}).attr("height",function(e){return e.vert?C.length*(a.barHeight+a.barGap)+a.barHeight*2:m}).attr("transform-origin",function(e,b){return b=e.order,(_(e.startTime)+v+.5*(_(e.endTime)-_(e.startTime))).toString()+"px "+(b*k+y+.5*m).toString()+"px"}).attr("class",function(e){const b="task";let I="";e.classes.length>0&&(I=e.classes.join(" "));let S=0;for(const[V,w]of Y.entries())e.type===w&&(S=V%a.numberSectionStyles);let D="";return e.active?e.crit?D+=" activeCrit":D=" active":e.done?e.crit?D=" doneCrit":D=" done":e.crit&&(D+=" crit"),D.length===0&&(D=" task"),e.milestone&&(D=" milestone "+D),e.vert&&(D=" vert "+D),D+=S,D+=" "+I,b+D}),T.append("text").attr("id",function(e){return e.id+"-text"}).text(function(e){return e.task}).attr("font-size",a.fontSize).attr("x",function(e){let b=_(e.startTime),I=_(e.renderEndTime||e.endTime);if(e.milestone&&(b+=.5*(_(e.endTime)-_(e.startTime))-.5*m,I=b+m),e.vert)return _(e.startTime)+v;const S=this.getBBox().width;return S>I-b?I+S+1.5*a.leftPadding>l?b+v-5:I+v+5:(I-b)/2+b+v}).attr("y",function(e,b){return e.vert?a.gridLineStartPadding+C.length*(a.barHeight+a.barGap)+60:(b=e.order,b*k+a.barHeight/2+(a.fontSize/2-2)+y)}).attr("text-height",m).attr("class",function(e){const b=_(e.startTime);let I=_(e.endTime);e.milestone&&(I=b+m);const S=this.getBBox().width;let D="";e.classes.length>0&&(D=e.classes.join(" "));let V=0;for(const[G,ot]of Y.entries())e.type===ot&&(V=G%a.numberSectionStyles);let w="";return e.active&&(e.crit?w="activeCritText"+V:w="activeText"+V),e.done?e.crit?w=w+" doneCritText"+V:w=w+" doneText"+V:e.crit&&(w=w+" critText"+V),e.milestone&&(w+=" milestoneText"),e.vert&&(w+=" vertText"),S>I-b?I+S+1.5*a.leftPadding>l?D+" taskTextOutsideLeft taskTextOutside"+V+" "+w:D+" taskTextOutsideRight taskTextOutside"+V+" "+w+" width-"+S:D+" taskText taskText"+V+" "+w+" width-"+S}),nt().securityLevel==="sandbox"){let e;e=ht("#i"+n);const b=e.nodes()[0].contentDocument;T.filter(function(I){return s.has(I.id)}).each(function(I){var S=b.querySelector("#"+I.id),D=b.querySelector("#"+I.id+"-text");const V=S.parentNode;var w=b.createElement("a");w.setAttribute("xlink:href",s.get(I.id)),w.setAttribute("target","_top"),V.appendChild(w),w.appendChild(S),w.appendChild(D)})}}c(Q,"drawRects");function H(u,k,y,v,m,o,l,h){if(l.length===0&&h.length===0)return;let d,T;for(const{startTime:S,endTime:D}of o)(d===void 0||S<d)&&(d=S),(T===void 0||D>T)&&(T=D);if(!d||!T)return;if(P(T).diff(P(d),"year")>5){et.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}const s=i.db.getDateFormat(),A=[];let e=null,b=P(d);for(;b.valueOf()<=T;)i.db.isInvalidDate(b,s,l,h)?e?e.end=b:e={start:b,end:b}:e&&(A.push(e),e=null),b=b.add(1,"d");L.append("g").selectAll("rect").data(A).enter().append("rect").attr("id",S=>"exclude-"+S.start.format("YYYY-MM-DD")).attr("x",S=>_(S.start.startOf("day"))+y).attr("y",a.gridLineStartPadding).attr("width",S=>_(S.end.endOf("day"))-_(S.start.startOf("day"))).attr("height",m-k-a.gridLineStartPadding).attr("transform-origin",function(S,D){return(_(S.start)+y+.5*(_(S.end)-_(S.start))).toString()+"px "+(D*u+.5*m).toString()+"px"}).attr("class","exclude-range")}c(H,"drawExcludeDays");function X(u,k,y,v){if(y<=0||u>k)return 1/0;const m=k-u,o=P.duration({[v??"day"]:y}).asMilliseconds();return o<=0?1/0:Math.ceil(m/o)}c(X,"getEstimatedTickCount");function Z(u,k,y,v){const m=i.db.getDateFormat(),o=i.db.getAxisFormat();let l;o?l=o:m==="D"?l="%d":l=a.axisFormat??"%Y-%m-%d";let h=ve(_).tickSize(-v+k+a.gridLineStartPadding).tickFormat(Wt(l));const T=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(i.db.getTickInterval()||a.tickInterval);if(T!==null){const s=parseInt(T[1],10);if(isNaN(s)||s<=0)et.warn(`Invalid tick interval value: "${T[1]}". Skipping custom tick interval.`);else{const A=T[2],e=i.db.getWeekday()||a.weekday,b=_.domain(),I=b[0],S=b[1],D=X(I,S,s,A);if(D>xt)et.warn(`The tick interval "${s}${A}" would generate ${D} ticks, which exceeds the maximum allowed (${xt}). This may indicate an invalid date or time range. Skipping custom tick interval.`);else switch(A){case"millisecond":h.ticks(jt.every(s));break;case"second":h.ticks(Ht.every(s));break;case"minute":h.ticks(zt.every(s));break;case"hour":h.ticks(Bt.every(s));break;case"day":h.ticks(Rt.every(s));break;case"week":h.ticks(Ut[e].every(s));break;case"month":h.ticks(Nt.every(s));break}}}if(L.append("g").attr("class","grid").attr("transform","translate("+u+", "+(v-50)+")").call(h).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),i.db.topAxisEnabled()||a.topAxis){let s=Se(_).tickSize(-v+k+a.gridLineStartPadding).tickFormat(Wt(l));if(T!==null){const A=parseInt(T[1],10);if(isNaN(A)||A<=0)et.warn(`Invalid tick interval value: "${T[1]}". Skipping custom tick interval.`);else{const e=T[2],b=i.db.getWeekday()||a.weekday,I=_.domain(),S=I[0],D=I[1];if(X(S,D,A,e)<=xt)switch(e){case"millisecond":s.ticks(jt.every(A));break;case"second":s.ticks(Ht.every(A));break;case"minute":s.ticks(zt.every(A));break;case"hour":s.ticks(Bt.every(A));break;case"day":s.ticks(Rt.every(A));break;case"week":s.ticks(Ut[b].every(A));break;case"month":s.ticks(Nt.every(A));break}}}L.append("g").attr("class","grid").attr("transform","translate("+u+", "+k+")").call(s).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}c(Z,"makeGrid");function E(u,k){let y=0;const v=Object.keys(W).map(m=>[m,W[m]]);L.append("g").selectAll("text").data(v).enter().append(function(m){const o=m[0].split(Ce.lineBreakRegex),l=-(o.length-1)/2,h=$.createElementNS("http://www.w3.org/2000/svg","text");h.setAttribute("dy",l+"em");for(const[d,T]of o.entries()){const s=$.createElementNS("http://www.w3.org/2000/svg","tspan");s.setAttribute("alignment-baseline","central"),s.setAttribute("x","10"),d>0&&s.setAttribute("dy","1em"),s.textContent=T,h.appendChild(s)}return h}).attr("x",10).attr("y",function(m,o){if(o>0)for(let l=0;l<o;l++)return y+=v[o-1][1],m[1]*u/2+y*u+k;else return m[1]*u/2+k}).attr("font-size",a.sectionFontSize).attr("class",function(m){for(const[o,l]of Y.entries())if(m[0]===l)return"sectionTitle sectionTitle"+o%a.numberSectionStyles;return"sectionTitle"})}c(E,"vertLabels");function p(u,k,y,v){const m=i.db.getTodayMarker();if(m==="off")return;const o=L.append("g").attr("class","today"),l=new Date,h=o.append("line");h.attr("x1",_(l)+u).attr("x2",_(l)+u).attr("y1",a.titleTopMargin).attr("y2",v-a.titleTopMargin).attr("class","today"),m!==""&&h.attr("style",m.replace(/,/g,";"))}c(p,"drawToday");function f(u){const k={},y=[];for(let v=0,m=u.length;v<m;++v)Object.prototype.hasOwnProperty.call(k,u[v])||(k[u[v]]=!0,y.push(u[v]));return y}c(f,"checkUnique")},"draw"),Ds={setConf:xs,draw:_s},Ss=c(t=>`
  .mermaid-main-font {
        font-family: ${t.fontFamily};
  }

  .exclude-range {
    fill: ${t.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${t.sectionBkgColor};
  }

  .section2 {
    fill: ${t.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${t.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${t.titleColor};
  }

  .sectionTitle1 {
    fill: ${t.titleColor};
  }

  .sectionTitle2 {
    fill: ${t.titleColor};
  }

  .sectionTitle3 {
    fill: ${t.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${t.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${t.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${t.fontFamily};
    fill: ${t.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${t.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${t.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${t.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${t.taskBkgColor};
    stroke: ${t.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${t.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${t.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${t.activeTaskBkgColor};
    stroke: ${t.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${t.doneTaskBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .vert {
    stroke: ${t.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${t.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.titleColor||t.textColor};
    font-family: ${t.fontFamily};
  }
`,"getStyles"),Cs=Ss,Fs={parser:We,db:bs,renderer:Ds,styles:Cs};export{Fs as diagram};
