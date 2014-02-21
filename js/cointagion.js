jQuery(document).ready(function(){
  FrontPage.init('#main','#front_page');
  InitCointagion();
});
FrontPage ={
  init: function(main,frontpage){
    $(main).css('opacity',0);
    $(frontpage).css('opacity',1);
    $('#front_text').css('margin-left',(window.innerWidth-145)/2);
    $('#front_text').css('margin-right',(window.innerWidth-145)/2);
    $('#front_text').css('margin-top',window.innerHeight/2);
    $(window).bind("load", function() {
      setTimeout(function(){
        FrontPage.SwitchFrontPlan(main,frontpage);
      },200);
    });
    $(window).bind('scroll resize', function() {
      $('#front_text').css('margin-left',(window.innerWidth-145)/2);
      $('#front_text').css('margin-right',(window.innerWidth-145)/2);
      $('#front_text').css('margin-top',window.innerHeight/2);
      $(frontpage).css('top', $(this).scrollTop());
    });
  },
  SwitchFrontPlan: function(main,frontpage){
    $(main).css('opacity',1);
    $(frontpage).css('opacity',0);
  }
}

var books = null;
var barcodes = {}
var barcode_requests={}
var barcode_delete_requests={}
var base_url = 'http://www.cointagion.com';
var session_hash = null;
var panicked = false;
var timeout=20*60*1000;
var iBooksPerPage=6;
var downloaded_books = null;
var sFormat = 'pdf';
var debugMode = false;

var bitcoin = bitcoin || {
  getClientInfo: function (callback) {
    var info = {
      firstname: 'Homer',
      lastname:  'Simpson',
      email:     'homer@fake.com',
      address:   'poqjer23rfc234laq',
      street:    'next to Flanders',
      zipcode:   '12233',
      city:      'Springfield',
      country:   'USA'
    };

    return callback(info);
  },

  sendCoins: function (hash, amount, callback) {
    return callback(true, hash);
  },

  sendCoinsForAddress: function(hash, amount, callback) {
    return callback(true, hash);
  }
};

function page_click() {
  var sText = $(this).attr('href');
  var aText = sText.split("_");

  updateBooks(aText[0],parseInt(aText[1]));

  return false;
}


function updatePagination(filter,iPage,iMaxItems) {
  var iMaxPage = Math.ceil(iMaxItems/iBooksPerPage);

  var oPagination = $('#pagination');

  if(iMaxPage<2) {
    oPagination.hide();
    return;
  }else{
    oPagination.show();
  }

  oPagination = $('#pagination_center');

  oPagination.empty();

  for(var n=0;n<iMaxPage;n++) {
    var oNewPagin = $('#pagination_template').clone();
    oNewPagin.attr('id','page_'+n);
    var oLink = oNewPagin.children();

    oLink.attr('href',filter+'_'+n).html(n+1);

    oLink.bind( "click", page_click);

    oPagination.append(oNewPagin);
  }

  $('#pagination > span:first-child a').attr('href',filter+'_0').bind( "click", page_click);
  $('#pagination > span:last-child a').attr('href',filter+'_'+(iMaxPage-1)).bind( "click", page_click);
}

function updateBooks(filter,iPage) {
  var iEndPage = (iPage+1)*iBooksPerPage;
  var iStartBook = iPage*iBooksPerPage;
  var iCounter = 0;
  var oLoading = $('#loading');
  var oBooks = $('#books');

  oLoading.show();
  oBooks.hide();

  oBooks.empty();
  oBooks.scrollTop(0);

  deletePayment();

  barcodes = [];


  for(var n=0;n<books.length;n++) {

    var book=books[n];
    var in_set;

    if(filter=='popular')
      in_set=n<20;
    else
      in_set=($.inArray(filter,book.tags)!=-1);


    if(in_set) {

      if(iCounter>=iStartBook && iCounter<iEndPage) {
        var oNewBook = $('#book_template').clone();

        oNewBook.attr('id','book_'+n);
        oNewBook.find('.book_image  img').attr('src',book.image);

        var sText = book.title;
        sText = sText.replace(/(<([^>]+)>)/ig,"");

        oNewBook.find('.book_title').html(sText);
        oNewBook.find('.book_desc').html(book.desc);

        oBooks.append(oNewBook);

        if ($.inArray(n,downloaded_books)!=-1)
          updateDownload(n);
      }

      iCounter++;

    }
    //if(iStartBook==iEndPage)
    //	break;

  }

  updatePagination(filter,iPage,iCounter);
  $('#page_'+iPage+' > a').addClass('current');
  setPayment();

  oLoading.hide();
  oBooks.show();

}


function updateDownload(book_id) {
  var book=books[book_id]
  var fmt='pdf'
  var filename='file'

  if(book!=null) {
    fmt=book.pdf_only?fmt:sFormat;
    filename=book.filename;
  }

  var bb=$('.book[id="book_'+book_id+'"]');

  var book_address = base_url+'/books/'+book_id+'/'+fmt;
  var full_address = book_address + '/'+filename+'.'+fmt;

  bb.find('.buy_button').removeClass('show_button').addClass('hide_button');
  bb.find('.download_button').attr('href',full_address);
  bb.find('.download_button').removeClass('hide_button').addClass('show_button');

  /*bb.find('.download_button').bind( "click", function() {

    download_file($(this).attr('href'));

    return false;
    });*/

  return book_address;

}

function deletePayment() {
  for(var book_id in barcodes) {
    if(barcode_delete_requests[book_id])
      continue;

    barcode_delete_requests[book_id] = true;

    jQuery.ajax({type: 'DELETE',
                async:false,
                url:base_url+'/addresses/'+book_id,
                data:{},
                success:function(data) {
                  delete barcodes[book_id];
                  barcode_delete_requests[book_id] = false;

                  var oBook = $('book[id="book_'+book_id+'"]');
                  oBook.find('.bitcoin_price').html('');
                  oBook.find('.dolar_price').html('');
                  oBook.find('.buy_button').hide();
                }
    });

  }
}

function setPayment() {

  $('#books').children('.book').each(function(){

    var oBook = $(this);
    var book_id = parseInt(oBook.attr('id').substr(5));

    if(!barcodes[book_id]  && !barcode_requests[book_id]) {
      barcode_requests[book_id] = true;

      jQuery.ajax({type: 'POST',
                  async:true,
                  url:base_url+'/addresses/'+book_id,
                  data:{},
                  success:function(data) {
                    try {
                      barcodes[book_id]=get_tick_count();

                      delete barcode_requests[book_id];

                      var json = jQuery.parseJSON(data);

                      oBook.find('.bitcoin_price').html(json.btc);
                      oBook.find('.dolar_price').html(json.dollars);
                      oBook.find('.buy_button').attr('href',json.address);
                      oBook.find('.buy_button').bind( "click", function() {

                        var bb = $(this);

                        if(!bb.hasClass('buy_button_disabled')) {
                          payCoins(bb.attr('href'), json.btc);
                          bb.addClass('buy_button_disabled');
                        }

                        return false;

                      });

                    }catch(err) {
                      debugLogError(err);
                    }

                  }
      });

    }


  });
}


function debugLogError(message) {
  console.log(message);
  alert(message);
}

function reloadPage() {

  jQuery.ajax({
    type: 'GET',
    async:false,
    url:base_url,
    data:{},
    success:function(data) { }
  });

  var urladr = base_url+'/books';

  jQuery.ajax({type: 'GET',
              async:false,
              url:urladr,
              data:{},
              success:function(data) {

                try {
                  books = jQuery.parseJSON(data);

                  updateBooks('popular',0);

                }catch(err) {
                  debugLogError(err);
                }

              }
  });

}

function get_tick_count() {
  return new Date().getTime();
}

var ErrorCode = { 'SessionError':0,'ConnectionError':1,'SessionTimeoutError':2 }

function showError(eCode) {
  if(panicked)
    return

  var sText = 'unkown';
  panicked = true;
  switch (eCode) {
    case ErrorCode.SessionError:
      sText = 'The server thinks you opened Cointagion in a second browser panel.<br><br>Please reload this page if you want to continue shopping from this panel.';
    break;

    case ErrorCode.ConnectionError:
      sText = 'I lost contact with the server.<br><br>Please reload this window to try reconnecting.';
    break;

    case ErrorCode.SessionTimeoutError:
      sText = '<br><br>Sorry, your session has timed out because of inactivity.<br><br>But fear not! A single click on this button and you\'re back in business!';
    break;

  }

  if(debugMode) {
    debugLogError(sText);
  }else {
    sText = sText.replace(/(<([^>]+)>)/ig,"");
    console.log(sText);
    //alert(sText);
    location.reload();
  }
}

function download_file(url) {
  $.fileDownload(url)
  .done(function () { alert('File download a success!'); })
  .fail(function () { alert('File download failed!'); });
  //window.location = url;
  //window.open(url,'_blank');
}

function check_payment() {
  var realUrl = base_url+'/payments';
  var fakeUrl = 'http://beta-gierowisko.olympicforkstudio.com/1/twitter-callbck';

  jQuery.ajax({dataType: "json",
              type: 'GET',
              async:false,
              url:fakeUrl,
              data:{},
              success:function(g) {
                var sh=g[0];
                var x=g[1];

                for(var i=0;i<x.length;i++)
                x[i]=parseInt(x[i])


                if(session_hash==null)
                  session_hash=sh
                else if(session_hash!=sh)
                  showError(ErrorCode.SessionError);

                if(downloaded_books==null) {
                  downloaded_books=x;

                  for(var i=0;i<x.length;i++) {
                    download_file(updateDownload(x[i]));
                  }

                }
                else {

                  for(var i=0;i<x.length;i++) {
                    var book_id=x[i];
                    if($.inArray(book_id,downloaded_books)==-1) {

                      downloaded_books.push(book_id);
                      download_file(updateDownload(book_id));
                    }
                  }

                }
              },
              error: function(jqXHR, textStatus, errorThrown) {
                showError(ErrorCode.ConnectionError);
              }
  });


}

function check_timeout() {
  if(panicked)
    return;

  tick=get_tick_count();

  for(var key in barcodes)
    if(tick-barcodes[key]>timeout)
      showError(ErrorCode.SessionTimeoutError);
}


function payCoins(sNumber, btcprice) {

  console.log('payCoins:'+sNumber+';'+btcprice);
  bitcoin.sendCoins(sNumber, btcprice, function(){
    //PAYMENT CALLBACK wywolywany gdy portfel potwierdzi transakcje

  });
}

function InitCointagion() {
  if(debugMode) {
    downloaded_books = new Array();
    downloaded_books[0] = 0;
    downloaded_books[1] = 3;

    for(var i = 0;i<6;i++) {
      var oNewBook = $('#book_template').clone();
      oNewBook.attr('id','book_'+i);
      $('#books').append(oNewBook);
    }
  }

  jQuery('.bar_link').click(function(data) {
    var link=$(this);
    $('.selected').removeClass('selected');
    updateBooks(link.html().replace(' ','_'),0);
    link.parent().addClass('selected');
    return false;
  });

  reloadPage();
  setInterval(check_payment,2000);
  setInterval(check_timeout,100);

}

