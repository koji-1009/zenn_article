---
title: "ImageとImageProvider"
emoji: "🤳"
type: "tech" # tech: 技術記事 / idea: アイデア
topics:
  - "flutter"
  - "image"
published: true
published_at: "2024-01-05 09:00"
---

## はじめに

モバイルアプリケーションには、画像の表示が欠かせません。
assetsとして同梱したり、ネットワークから取得したりと、さまざまな方法で画像を表示することになります。

しかし、この画像を表示する際に`Image`と`ImageProvider`を**理解して**利用したことはあるでしょうか？
この記事では、ノリで利用しがちな`Image`と`ImageProvider`について理解を深めます。

…というテイで、画像読み込みライブラリを自作した際のコードリーディングの振り返りメモです。よろしくお願いします。

## Image

https://api.flutter.dev/flutter/widgets/Image-class.html

`Image`は`StatefulWidget`を継承したWidgetです。このため、アプリケーションの中で画像を表示する際には、`Image`を利用することになります。

`Image`クラスには、下記5パターンのコンストラクタが用意されています。
`Image`クラスを利用する場合には、このなかの**特定の形式で画像データを取得する**コンストラクタ、つまり1つ目を除いた4つのコンストラクタを利用することになります。

以下、公式ドキュメントからの引用です。

* [Image.new](https://api.flutter.dev/flutter/widgets/Image/Image.html), for obtaining an image from an [ImageProvider](https://api.flutter.dev/flutter/painting/ImageProvider-class.html).
* [Image.asset](https://api.flutter.dev/flutter/widgets/Image/Image.asset.html), for obtaining an image from an [AssetBundle](https://api.flutter.dev/flutter/services/AssetBundle-class.html) using a key.
* [Image.network](https://api.flutter.dev/flutter/widgets/Image/Image.network.html), for obtaining an image from a URL.
* [Image.file](https://api.flutter.dev/flutter/widgets/Image/Image.file.html), for obtaining an image from a [File](https://api.flutter.dev/flutter/dart-io/File-class.html).
* [Image.memory](https://api.flutter.dev/flutter/widgets/Image/Image.memory.html), for obtaining an image from a [Uint8List](https://api.flutter.dev/flutter/dart-typed_data/Uint8List-class.html).

これら4つのコンストラクタを見比べてみると、`.asset`だけちょっとした違いがあるのですが、基本的には`final ImageProvider image;`に対して`ResizedImage.resizeIfNeeded`をセットしています。

https://github.com/flutter/flutter/blob/3.16.0/packages/flutter/lib/src/widgets/image.dart

説明用に順番を整理の上、必要な箇所だけ引用すると、次のようになります。

```dart
class Image extends StatefulWidget {

  /// The image to display.
  final ImageProvider image;

  Image.network(
    String src, {
    super.key,
    double scale = 1.0,
    int? cacheWidth,
    int? cacheHeight,
  }) : image = ResizeImage.resizeIfNeeded(cacheWidth, cacheHeight, NetworkImage(src, scale: scale, headers: headers));

  Image.file(
    File file, {
    super.key,
    double scale = 1.0,
    int? cacheWidth,
    int? cacheHeight,
  }) : image = ResizeImage.resizeIfNeeded(cacheWidth, cacheHeight, FileImage(file, scale: scale));

  Image.asset(
    String name, {
    super.key,
    AssetBundle? bundle,
    String? package,
    double? scale,
    int? cacheWidth,
    int? cacheHeight,
  }) : image = ResizeImage.resizeIfNeeded(
        cacheWidth,
        cacheHeight,
        scale != null
          ? ExactAssetImage(name, bundle: bundle, scale: scale, package: package)
          : AssetImage(name, bundle: bundle, package: package),
      );

  Image.memory(
    Uint8List bytes, {
    super.key,
    double scale = 1.0,
    int? cacheWidth,
    int? cacheHeight,
  }) : image = ResizeImage.resizeIfNeeded(cacheWidth, cacheHeight, MemoryImage(bytes, scale: scale));
}
```

ここで現れる`ResizeImage`、`ImageProvider`、`NetworkImage`、`FileImage`、`ExactAssetImage`、`AssetImage`、`MemoryImage`は(当然ですが)`ImageProvider`を継承しています。また、ここを確認すると`Image.new`が`ImageProvider`を要求しているので、`ImageProvider`を自作した場合には`Image.new`を利用すればいいことがわかりますね。

`Image`クラスは非常によくできており、リソースの読み込み周りを`ImageProvider`に分割することで、Widgetとしての処理を共通化しています。`build`メソッド周辺を見てみましょう。

```dart
class _ImageState extends State<Image> with WidgetsBindingObserver {
  ImageInfo? _imageInfo;

  void _handleImageFrame(ImageInfo imageInfo, bool synchronousCall) {
    setState(() {
      _replaceImage(info: imageInfo);
      _loadingProgress = null;
      _lastException = null;
      _frameNumber = _frameNumber == null ? 0 : _frameNumber! + 1;
      _wasSynchronouslyLoaded = _wasSynchronouslyLoaded | synchronousCall;
    });
  }

  void _replaceImage({required ImageInfo? info}) {
    final ImageInfo? oldImageInfo = _imageInfo;
    SchedulerBinding.instance.addPostFrameCallback((_) => oldImageInfo?.dispose());
    _imageInfo = info;
  }

  @override
  Widget build(BuildContext context) {
    if (_lastException != null) {
      if (widget.errorBuilder != null) {
        return widget.errorBuilder!(context, _lastException!, _lastStack);
      }
      if (kDebugMode) {
        return _debugBuildErrorWidget(context, _lastException!);
      }
    }

    Widget result = RawImage(
      // Do not clone the image, because RawImage is a stateless wrapper.
      // The image will be disposed by this state object when it is not needed
      // anymore, such as when it is unmounted or when the image stream pushes
      // a new image.
      image: _imageInfo?.image,
      debugImageLabel: _imageInfo?.debugLabel,
      width: widget.width,
      height: widget.height,
      scale: _imageInfo?.scale ?? 1.0,
      color: widget.color,
      opacity: widget.opacity,
      colorBlendMode: widget.colorBlendMode,
      fit: widget.fit,
      alignment: widget.alignment,
      repeat: widget.repeat,
      centerSlice: widget.centerSlice,
      matchTextDirection: widget.matchTextDirection,
      invertColors: _invertColors,
      isAntiAlias: widget.isAntiAlias,
      filterQuality: widget.filterQuality,
    );

    if (!widget.excludeFromSemantics) {
      result = Semantics(
        container: widget.semanticLabel != null,
        image: true,
        label: widget.semanticLabel ?? '',
        child: result,
      );
    }

    if (widget.frameBuilder != null) {
      result = widget.frameBuilder!(context, result, _frameNumber, _wasSynchronouslyLoaded);
    }

    if (widget.loadingBuilder != null) {
      result = widget.loadingBuilder!(context, result, _loadingProgress);
    }

    return result;
  }
}
```

`Image`クラスの引数として、もしくは画像読み込みライブラリで指定したことのある、いくつかのbuilderが登場します。
現時点では、**何らかのStreamをハンドリングしている**ことと**ImageInfoをハンドリングしている**ことを把握しておけば、あとは`build`メソッド内でよしなに処理が行われることが把握できるのではないでしょうか。

---

では、`ImageProvider`がどのように接続されるのか、見ていきましょう。
何となく`_handleImageFrame`と`final ImageProvider image`が組み合わされていることが予想できます。なので、その予想を確かめていきます。

まず、`_handleImageFrame`が呼び出される`_getListener`メソッドを見てみましょう。`recreateListener`には、`didUpdateWidget`でWidgetの中身を更新する必要がある時に、`true`が渡されます。

処理が多いように見えますが、builderの指定がないケースでは、それぞれ`null`の判定をしているだけです。

```dart
class _ImageState extends State<Image> with WidgetsBindingObserver {
  ImageStreamListener? _imageStreamListener;

  ImageStreamListener _getListener({bool recreateListener = false}) {
    if (_imageStreamListener == null || recreateListener) {
      _lastException = null;
      _lastStack = null;
      _imageStreamListener = ImageStreamListener(
        _handleImageFrame,
        onChunk: widget.loadingBuilder == null ? null : _handleImageChunk,
        onError: widget.errorBuilder != null || kDebugMode
            ? (Object error, StackTrace? stackTrace) {
                setState(() {
                  _lastException = error;
                  _lastStack = stackTrace;
                });
                assert(() {
                  if (widget.errorBuilder == null) {
                    // ignore: only_throw_errors, since we're just proxying the error.
                    throw error; // Ensures the error message is printed to the console.
                  }
                  return true;
                }());
              }
            : null,
      );
    }
    return _imageStreamListener!;
  }
}

/// Interface for receiving notifications about the loading of an image.
@immutable
class ImageStreamListener {
  const ImageStreamListener(
    this.onImage, {
    this.onChunk,
    this.onError,
  });

  final ImageListener onImage;
  final ImageChunkListener? onChunk;
  final ImageErrorListener? onError;
}

typedef ImageListener = void Function(ImageInfo image, bool synchronousCall);
typedef ImageChunkListener = void Function(ImageChunkEvent event);
typedef ImageErrorListener = void Function(Object exception, StackTrace? stackTrace);
```

続いて、`_getListener`メソッドのことを頭の片隅に置きつつ、`ImageStream`を処理している箇所を追いかけます。なお、可読性のために省略している箇所があります。

```dart
class _ImageState extends State<Image> with WidgetsBindingObserver {
  ImageStream? _imageStream;
  bool _isListeningToStream = false;

  @override
  void didChangeDependencies() {
    _resolveImage();

    if (TickerMode.of(context)) {
      _listenToStream();
    } else {
      _stopListeningToStream(keepStreamAlive: true);
    }

    super.didChangeDependencies();
  }

  void _resolveImage() {
    final ScrollAwareImageProvider provider = ScrollAwareImageProvider<Object>(
      context: _scrollAwareContext,
      imageProvider: widget.image,
    );
    final ImageStream newStream =
      provider.resolve(createLocalImageConfiguration(
        context,
        size: widget.width != null && widget.height != null ? Size(widget.width!, widget.height!) : null,
      ));
    _updateSourceStream(newStream);
  }

   void _updateSourceStream(ImageStream newStream) {
    if (_imageStream?.key == newStream.key) {
      return;
    }

    if (_isListeningToStream) {
      _imageStream!.removeListener(_getListener());
    }

    if (!widget.gaplessPlayback) {
      setState(() { _replaceImage(info: null); });
    }

    setState(() {
      _frameNumber = null;
      _wasSynchronouslyLoaded = false;
    });

    _imageStream = newStream;
    if (_isListeningToStream) {
      _imageStream!.addListener(_getListener());
    }
  }

  void _listenToStream() {
    if (_isListeningToStream) {
      return;
    }

    _imageStream!.addListener(_getListener());
    _completerHandle?.dispose();
    _completerHandle = null;

    _isListeningToStream = true;
  }
}
```

`ScrollAwareImageProvider`が登場しましたが、一旦目を瞑りましょう。これは後ほど`ImageProvider`の箇所で確認します。
`_imageStream`に目を向けてみると、`TickerMode`がtrueであれば、`_imageStream`と`getListener`が紐づいていることがわかります。`TickerMode`がfalseである場合には、そもそもwidgetの更新アニメーションが走らない状態なので、`Image`ウィジェットが適切に動作していない状態になっている…ハズです。

以上で、`final ImageProvider image;`で指定した`ImageProvider`が、`_handleImageFrame`の呼び出しにつながることがわかりました。
当初の予想通りですね。

---

続いて、`ImageProvider`を読んでいきたいところなのですが、その前に`ImageCache`を確認します。
`ImageProvider`のコードを読んでいくと明らかなのですが、`ImageProvider`内で読み込まれる画像は、`ImageCache`にキャッシュされます。このキャッシュ処理が複雑なので、あらかじめ`ImageCache`を確認しておき、`ImageProvider`のロジックをさっくり読んでしまおう、という試みです。

## ImageCache

https://api.flutter.dev/flutter/painting/ImageCache-class.html

> Class for caching images.
> 
> Implements a least-recently-used cache of up to 1000 images, and up to 100 MB. The maximum size can be adjusted using [maximumSize](https://api.flutter.dev/flutter/painting/ImageCache/maximumSize.html) and [maximumSizeBytes](https://api.flutter.dev/flutter/painting/ImageCache/maximumSizeBytes.html).

`ImageCache`は、メモリで画像をキャッシュするためのクラスです。Lruキャッシュを利用しており、メモリを効率的に利用しています。
Androidエンジニアの方であれば、PicassoやGlideのメモリキャッシュと同じ方式と言えば、一発でわかるハズです。^[Coilもコードを見る感じ、Lruキャッシュっぽいですね]

`ImageCache`のインスタンスは、`PaintingBinding.instance.imageCache`で取得できます。
[PaintingBinding](https://api.flutter.dev/flutter/painting/PaintingBinding-mixin.html)のsingletonインスタンス上で`imageCache`を保持しています。`ImageCache`は1つで十分と言うか、1つだからこそ意味があるので、この実装は妥当ですね。

---

`ImageCache`の実装を読んでいると、最もびっくりさせられるのは**ImageProviderをキー**に**ImageStreamCompleterを管理**している点です。

Lruキャッシュで新規にキャッシュを追加する場合には、`putIfAbsent`メソッドを利用します。メソッドを確認していきましょう。

https://api.flutter.dev/flutter/painting/ImageCache/putIfAbsent.html

> Returns the previously cached [ImageStream](https://api.flutter.dev/flutter/painting/ImageStream-class.html) for the given key, if available; if not, calls the given callback to obtain it first. In either case, the key is moved to the 'most recently used' position.
> 
> In the event that the loader throws an exception, it will be caught only if onError is also provided. When an exception is caught resolving an image, no completers are cached and null is returned instead of a new completer.

実際にコードを見てみると、次のような記述になっています。なにこれ、って感じですね。

https://github.com/flutter/flutter/blob/3.16.0/packages/flutter/lib/src/painting/image_cache.dart#L322-L455

読み解ける方はそのまま読んでもらった方が良い^[解説できない内容が多いので…]のですが、一応解説を試みます。

`ImageCacache`では次の3つの`Map`を管理しています。
この`Map`は順序を持っています。このため`first`で古いものから、`last`で新しいものからアクセスできます。

* `final Map<Object, _PendingImage> _pendingImages = <Object, _PendingImage>{};`
* `final Map<Object, _CachedImage> _cache = <Object, _CachedImage>{};`
* `final Map<Object, _LiveImage> _liveImages = <Object, _LiveImage>{};`

この3つのMapは、それぞれ異なる目的を持ちます。
コードを読んで把握しようとすると大変辛いので、`ImageCache#statusForKey`で取得できる`ImageCacheStatus`クラスの説明を確認します。^[一度コードから説明しようとして、この節は全部書き直しています]

https://github.com/flutter/flutter/blob/3.16.0/packages/flutter/lib/src/painting/image_cache.dart#L458-L464

`ImageCacheSatus`の生成方法を見ましたね？
このようにbool値を判定していることを踏まえて、`ImageCacheStatus`のドキュメントを確認します。

https://api.flutter.dev/flutter/painting/ImageCacheStatus-class.html

> A pending image is one that has not completed yet. It may also be tracked as live because something is listening to it.
> 
> A keepAlive image is being held in the cache, which uses Least Recently Used semantics to determine when to evict an image. These images are subject to eviction based on ImageCache.maximumSizeBytes and ImageCache.maximumSize. It may be live, but not pending.
> 
> A live image is being held until its ImageStreamCompleter has no more listeners. It may also be pending or keepAlive.

`pending`で言及されているのは、`putIfAbsent`の第2引数で指定した`loader`であり、その実態は`ImageProvider#loadImage`です。
また`pending`つまり`_pendingImages`で完了した処理は、`keepAlive`つまり`_cache`に移し替えられます。この2つが保持されていることと、2つの関係性は、直感的に理解しやすいと思います。

一方で、`live`はイマイチ掴みかねる要素です。
`pending`と`keepAlive`で保持するべきキャッシュは十分なように思えます。というかコメントにもあるように、`live`はこれらのキャッシュと二重に保持されます。なぜなのでしょうか？

`_liveImages`に保持され`live`の判定になるのは、`putIfAbsent`で返却された`ImageStreamCompleter`が存在している状態です。
この**存在している限り**は、`Image`クラスのStateとして保持されていることを意味します。コードとしては`_ImageState`の`_resolveImage`にて、`ImageStream`が生成されStateとして保持されている状態です。

これは、複数の画像を`Column`で並べたようなケースを想定すると、イメージしやすいのではないでしょうか。
`Column`は、子要素のWidgetを全て生成します。すると、子要素になっているすべての`Image`において、`ImageStreamCompleter`は保持されている状態になります。これが`ListView.builder`だと、`keepAlive`の指定にもよるのですが、大抵は画面に表示されている子要素のみが保持されている状態です。

このように**今表示されている画像**が、`live`つまり`_liveImages`にキャッシュされます。

`_cache`と`_liveImages`には、キャッシュのサイズがチェックされるかどうか、という違いがあります。
`_cache`は設定されたサイズを超えると、古いものから削除される処理があります。一方で、`_liveImages`にはありません。30MBぐらいのでかい画像が複数表示されていることを見ると、納得のいく動きになっているのがわかると思います。

---

以上で、`ImageCache`の実装を確認できました。
ここから、本題である`ImageProvider`を確認します。

## ImageProvider

長々と`Image`を読み進めてみると、`Image`クラスが**RowImageを表示するためのWidget**であることがわかります。
読み込み処理やキャッシュ処理などは、全て`ImageProvider`の責務です。

https://api.flutter.dev/flutter/painting/ImageProvider-class.html

---

`ImageProvider`の継承クラスには、次の3つのメソッドが登場します。

* [obtainKey](https://api.flutter.dev/flutter/painting/ImageProvider/obtainKey.html)
  * Converts an [ImageProvider](https://api.flutter.dev/flutter/painting/ImageProvider-class.html)'s settings plus an [ImageConfiguration](https://api.flutter.dev/flutter/painting/ImageConfiguration-class.html) to a key that describes the precise image to load. 
* [loadBuffer](https://api.flutter.dev/flutter/painting/ImageProvider/loadBuffer.html)
  * Converts a key into an [ImageStreamCompleter](https://api.flutter.dev/flutter/painting/ImageStreamCompleter-class.html), and begins fetching the image. 
  * This method is deprecated. Implement `loadImage` instead.
* [loadImage](https://api.flutter.dev/flutter/painting/ImageProvider/loadImage.html)
  * Converts a key into an [ImageStreamCompleter](https://api.flutter.dev/flutter/painting/ImageStreamCompleter-class.html), and begins fetching the image. 

`obtainKey`が特殊な実装になっているのは、`ResizeImage`と`AssetImage`、そして`ExactAssetImage`です。
`AssetImage`と`ExactAssetImage`の違いは、Flutterのassetsで`2.0x`や`3.0x`のような複数の解像度が異なる画像を梱包した時に、それらを自動的に切り替える(`AssetImage`)か指定した解像度を表示する(`ExactAssetImage`)かになります。このため、この2つは別物ではありますが、ほぼ同じと見做せます。

また、これらは[Bundle](https://api.flutter.dev/flutter/services/AssetBundle-class.html)を利用して画像を取得する必要があります。このため、`obtainKey`の処理に`AssetBundle`が関係することとなり、他の`ImageProvider`とは異なる実装となります。

そしてFlutter 3.7.0より、`loadBuffer`はdeprecatedとなり、`loadImage`に置き換えられています。
要するに、見なければいけないのは`loadImage`だけ、ということです。

---

`Image`クラスの中に登場した、`ImageProvider`の実装を並べてみます。

* `NetworkImage`
* `FileImage`
* `ExactAssetImage`
* `AssetImage`
* `MemoryImage`
* `ResizeImage`
* `ScrollAwareImageProvider` 

このうち、`ScrollAwareImageProvider`は`Image`の中で登場しましたが、明らかに他の`ImageProvider`とは異なる役割を担っています。まず、`ScrollAawareImageProvider`をさっと確認しつつ、次の`ImageProvider`を詳細にみていきます。

### ScrollAwareImageProvider

https://api.flutter.dev/flutter/widgets/ScrollAwareImageProvider-class.html

`ScrollAwareImageProvider`は、ドキュメントの説明を読めば、その役割がわかります。

> An [ImageProvider](https://api.flutter.dev/flutter/painting/ImageProvider-class.html) that makes use of [Scrollable.recommendDeferredLoadingForContext](https://api.flutter.dev/flutter/widgets/Scrollable/recommendDeferredLoadingForContext.html) to avoid loading images when rapidly scrolling.
> 
> This provider assumes that its wrapped [imageProvider](https://api.flutter.dev/flutter/widgets/ScrollAwareImageProvider/imageProvider.html) correctly uses the [ImageCache](https://api.flutter.dev/flutter/painting/ImageCache-class.html), and does not attempt to re-acquire or decode images in the cache.

前半は『`ScrollAwareImageProvider`は、`Scrollable.recommendDeferredLoadingForContext`を利用して、高速スクロール時に画像を読み込まないようにします。』ということですね。高速スクロール時に画像を読み込まないことで、スクロールのパフォーマンスを保っているのかな、と思います。

後半の内容は、先ほど確認した`ImageCache`の仕組みを前提としている、と言うことです。
`ImageCache`では、読み込み前から読み込み後、現在参照されている画像読み込み処理をキャッシュしています。このため、`ImageProvider`の継承クラスが正確な実装となり、適切に`imageCache`を利用していれば、ラッパーである`ScrollAwareImageProvider`が画像の再取得やデコードを行う必要がありません。

### MemoryImage

`ImageProvider`の最もシンプルな実装は、`MemoryImage`です。
`MemoryImage`は`Uint8List`、つまり画像のバイト列を受け取り表示します。

結局のところ、画像のデータをどこから(InternetやFileなど)から取得しても、最終的にはバイト列に変換する必要があるわけです。つまり、`MemoryImage`は開発者が**自前でバイト列に変換した**ケースの`ImageProvider`と言えます。

https://api.flutter.dev/flutter/painting/MemoryImage-class.html

> Decodes the given [Uint8List](https://api.flutter.dev/flutter/dart-typed_data/Uint8List-class.html) buffer as an image, associating it with the given scale.

クラスは次の箇所にあります。前述の通り、確認が必要なのは`loadImage`だけです。

https://github.com/flutter/flutter/blob/3.16.0/packages/flutter/lib/src/painting/image_provider.dart#L1522

```dart
import 'dart:ui' as ui;

@immutable
class MemoryImage extends ImageProvider<MemoryImage> {
  /// Creates an object that decodes a [Uint8List] buffer as an image.
  const MemoryImage(this.bytes, { this.scale = 1.0 });

  final Uint8List bytes;
  final double scale;  

  @override
  ImageStreamCompleter loadImage(MemoryImage key, ImageDecoderCallback decode) {
    return MultiFrameImageStreamCompleter(
      codec: _loadAsync(key, decode: decode),
      scale: key.scale,
      debugLabel: 'MemoryImage(${describeIdentity(key.bytes)})',
    );
  }

  Future<ui.Codec> _loadAsync(
    MemoryImage key, {
    required _SimpleDecoderCallback decode,
  }) async {
    assert(key == this);
    return decode(await ui.ImmutableBuffer.fromUint8List(bytes));
  }
}

typedef ImageDecoderCallback = Future<ui.Codec> Function(
  ui.ImmutableBuffer buffer, {
  ui.TargetImageSizeCallback? getTargetSize,
});
```

`_loadAsync`になっているのは、他のクラスと実装を合わせるためです。
内容はすごい簡単ですね、`Uint8List`を`ui.ImmutableBuffer.fromUint8List`で変換して、`decode`メソッドに渡すだけです。`ImageProvider`はabstractクラスなので、`loadImage`を呼び出した後の処理が実装されています。

---

処理を`Image`クラスの実装から見ていくと次のようになります。

1. `_ImageState#resolveImage`
   * `ImageStream`を取得処理の中で、`provider.resolve`を呼び出す
2. `ImageProvider#resolve`
   * `createStream`メソッドにより`ImageStream`を新規に生成
   * 生成した`ImageStream`を`ImageProvider#resolveStreamForKey`に渡す
3. `ImageProvider.resolveStreamForKey`
   * 2の処理で渡ってきた`stream.completer`がnullかどうかをチェック
     * nullの場合
       * `PaintingBinding.instance.imageCache.putIfAbsent`の`loader`を生成し、`stream.completer`にセット
       * `loader`の生成処理として、`ImageProvider#loadImage`を呼び出す
     * nullでない場合
       * `PaintingBinding.instance.imageCache.putIfAbsent`の`loader`に`stream.completer`をセット
       * ただし、このケースには`This is an unusual edge case`とコメントがある
4. `ImageProvider.loadImage`
   * `ImageProvider`はabstractクラスなので、`loadImage`は継承したクラスのものを呼び出す
   * `MemoryImage`の場合には`MemoryImage#loadImage`が呼ばれる

具体的に3の処理をみると、次の実装です。筆者がコメントを一部書き換えています。

```dart
@protected
void resolveStreamForKey(ImageConfiguration configuration, ImageStream stream, T key, ImageErrorListener handleError) {
  // エッジケースのパターン
  if (stream.completer != null) {
    final ImageStreamCompleter? completer = PaintingBinding.instance.imageCache.putIfAbsent(
      key,
      () => stream.completer!,
      onError: handleError,
    );
    return;
  }
  final ImageStreamCompleter? completer = PaintingBinding.instance.imageCache.putIfAbsent(
    key,
    () {
      ImageStreamCompleter result = loadImage(key, PaintingBinding.instance.instantiateImageCodecWithSize);
      // 元コードには、ここでloadBufferを呼び直す処理
      return result;
    },
    onError: handleError,
  );
  if (completer != null) {
    stream.setCompleter(completer);
  }
}
```

`PaintingBinding.instance.instantiateImageCodecWithSize`は、`dart:ui`の`instantiateImageCodecWithSize`を呼び出しています。
コードとドキュメントを読むと、`dart:ui`の[Image](https://api.flutter.dev/flutter/dart-ui/Image-class.html)を作り出す処理である、ということがわかります。なお、flutterのengineに行き着いてしまったので、ここで一旦終了です。

https://api.flutter.dev/flutter/dart-ui/instantiateImageCodec.html

https://github.com/flutter/engine/blob/3.16.0/lib/ui/painting.dart#L2191

話が横道に逸れてしまったのですが、`MemoryImage`の実装が確認できました。ようやく、`ImageProvider`とはなんなのかが掴めたのではないでしょうか？

### NetworkImage

https://api.flutter.dev/flutter/painting/NetworkImage-class.html

`NetworkImage`は、`MemoryImage`にネットワークからデータを取得する処理が追加された実装です。
ただ、`MemoryImage`と異なる点が2つあります。1つは「データの読み込みに時間がかかる」こと、もう1つは「webとそれ以外で通信に関する処理が異なる」ことです。

#### データの読み込み経過の通知

`MemoryImage`は、`Uint8List`を受け取っているので、データの読み込みに時間がかかることはありません。
一方で、`NetworkImage`はネットワークからデータを取得するため、読み込みに時間がかかることがあります。

話は戻りますが、`Image`クラスには`loadingBuilder`というプロパティがありました。
これは、画像の読み込み中に表示するWidgetを指定するためのプロパティです。

https://api.flutter.dev/flutter/widgets/Image/loadingBuilder.html

このbuilderでは、次の3つの引数を受け取ることができます。

```dart
Function(BuildContext context, Widget child, ImageChunkEvent? loadingProgress)
```

`_ImageState#bulid`メソッドを確認するとわかるのですが、`child`には`RawImage`か`Semantics`が渡されています。
このため、`child`はnon-nullであることが保証されています。
画像の読み込み状態を確認するためには、`loadingProgress`を利用します。

https://api.flutter.dev/flutter/painting/ImageChunkEvent-class.html

`ImageChunkEvent`は`int cumulativeBytesLoaded`と`int? expectedTotalBytes`の2つのプロパティを持ちます。
お察しの通り、`cumulativeBytesLoaded`は読み込み済みのバイト数、`expectedTotalBytes`は読み込むべきバイト数です。

`NetworkImage`では、ネットワークリクエストを適切に処理し、`ImageChunkEvent`を生成する必要があります。

#### ネットワークリクエストの処理

HTTPのGETリクエストを行う場合、大抵は[http](https://pub.dev/packages/http)や[dio](https://pub.dev/packages/dio)を利用します。
が、`NetworkImage`はFlutterの基本的なクラスであり、これらのクラスを利用していません。

httpパッケージの中身を除いたことがある方はご存知だと思うのですが、httpパッケージは`dart:io`と`dart:html`を利用しています。ioが利用できるmobileやdesktopと、利用できないwebで実装が分かれています。
同様の処理が、`NetworkImage`でも行われています。次の2ファイルです。

https://github.com/flutter/flutter/blob/3.16.0/packages/flutter/lib/src/painting/_network_image_io.dart

https://github.com/flutter/flutter/blob/3.16.0/packages/flutter/lib/src/painting/_network_image_web.dart

ここでは、主に利用されるであろう、ioの実装を見ていきます。

---

https://github.com/flutter/flutter/blob/3.16.0/packages/flutter/lib/src/painting/_network_image_io.dart#L58-L143

めっちゃ大変そうですね。今回はchunkを追いたいので、`final StreamController<ImageChunkEvent> chunkEvents = StreamController<ImageChunkEvent>();`を中心に見ていきます。
`_loadAsync`メソッドの引数に、`chunkEvents`が渡しているのが`MemoryImage`との差分その1。そして、`MultiFrameImageStreamCompleter`の引数に、`chunkEvents.stream`が渡されているのが差分その2です。

```dart
@immutable
class NetworkImage extends image_provider.ImageProvider<image_provider.NetworkImage> implements image_provider.NetworkImage {
  const NetworkImage(this.url, { this.scale = 1.0, this.headers });

  @override
  final String url;

  @override
  final double scale;

  @override
  final Map<String, String>? headers;

  @override
  ImageStreamCompleter loadImage(image_provider.NetworkImage key, image_provider.ImageDecoderCallback decode) {
    // Ownership of this controller is handed off to [_loadAsync]; it is that
    // method's responsibility to close the controller's stream when the image
    // has been loaded or an error is thrown.
    final StreamController<ImageChunkEvent> chunkEvents = StreamController<ImageChunkEvent>();

    return MultiFrameImageStreamCompleter(
      codec: _loadAsync(key as NetworkImage, chunkEvents, decode: decode),
      chunkEvents: chunkEvents.stream,
      scale: key.scale,
      debugLabel: key.url,
      informationCollector: () => <DiagnosticsNode>[
        DiagnosticsProperty<image_provider.ImageProvider>('Image provider', this),
        DiagnosticsProperty<image_provider.NetworkImage>('Image key', key),
      ],
    );
  }
}
```

`MultiFrameImageStreamCompleter`は、先ほど確認した通り`Image`クラスまで処理が戻ってきます。
このため、この`chunkEvents`が`Image`クラスの`loadingBuilder`まで届き、通信中かどうかを確認できるようになります。

続いて、`_loadAsync`メソッドを見て見ましょう。通信処理のアレコレを見なかったことにすると、次の箇所がchunkを処理していることがわかります。

```dart
final Uint8List bytes = await consolidateHttpClientResponseBytes(
  response,
  onBytesReceived: (int cumulative, int? total) {
    chunkEvents.add(ImageChunkEvent(
      cumulativeBytesLoaded: cumulative,
      expectedTotalBytes: total,
    ));
  },
);
if (bytes.lengthInBytes == 0) {
  throw Exception('NetworkImage is an empty file: $resolved');
}

return decode(await ui.ImmutableBuffer.fromUint8List(bytes));
```

`decode`については、`MemoryImage`と同じですね。なので、`onBytesReceived`にて`chunkEvents`にaddする箇所が差分その3です。

[consolidateHttpClientResponseBytes](https://api.flutter.dev/flutter/foundation/consolidateHttpClientResponseBytes.html)は、`dart:io`の`HttpClientResponse`を`Uint8List`に変換する処理です。通信処理そのものではなく、通信処理で得られたbodyを`Uint8List`に変換する処理になります。

なお、通信処理が失敗したケースと完了後も考慮する必要があります。

```dart
} catch (e) {
  // Depending on where the exception was thrown, the image cache may not
  // have had a chance to track the key in the cache at all.
  // Schedule a microtask to give the cache a chance to add the key.
  scheduleMicrotask(() {
    PaintingBinding.instance.imageCache.evict(key);
  });
  rethrow;
} finally {
  chunkEvents.close();
}
```

通信が失敗したケースでは、`ImageCache`からキャッシュの削除を行なっています。万が一キャッシュが残ってしまうと、次に同じURLで画像を取得しようとした時に、通信の失敗結果をキャッシュから取得することになるためです。
最後に、`finaly`句で`chunkEvents`を`close`しています。後片付けは大事ですね。

### ResizeImage

さて、最後の`ImageProvider`は`ResizeImage`です。

https://api.flutter.dev/flutter/painting/ResizeImage-class.html

`ResizeImage`そのものを見る前に、まず`ResizeImage.resizeIfNeeded`を見てみましょう。

```dart
class ResizeImage extends ImageProvider<ResizeImageKey> {
  static ImageProvider<Object> resizeIfNeeded(int? cacheWidth, int? cacheHeight, ImageProvider<Object> provider) {
    if (cacheWidth != null || cacheHeight != null) {
      return ResizeImage(provider, width: cacheWidth, height: cacheHeight);
    }
    return provider;
  }
}
```

`Image`の各コンストラクタには、`cacheWidth`と`cacheHeight`があります。
これらを指定しない場合、つまり`null`の場合には、リサイズの必要がないので、`provider`をそのまま返却しています。

#### obtainKey

`ResizeImage`の実装を見ていきましょう。
まずは、`obtainKey`です。

`ResizeImage`の特定には、引数にとる`ImageProvider`の`key`とリサイズの設定を合成する必要があります。
リサイズの指定だけでは**どの画像をリサイズするのか**が分からず、引数にとった`ImageProvider`の`key`だけでは**どのようにリサイズするのか**が分からないためです。

そして、`obtainKey`が非同期処理になるケースも考慮する必要があります。ちょろっと触れた、`AssetImage`が`AssetBundle`を利用するため、非同期処理を行う必要があるためです。

```dart
class ResizeImage extends ImageProvider<ResizeImageKey> {
  @override
  Future<ResizeImageKey> obtainKey(ImageConfiguration configuration) {
    Completer<ResizeImageKey>? completer;
    // If the imageProvider.obtainKey future is synchronous, then we will be able to fill in result with
    // a value before completer is initialized below.
    SynchronousFuture<ResizeImageKey>? result;
    imageProvider.obtainKey(configuration).then((Object key) {
      if (completer == null) {
        // This future has completed synchronously (completer was never assigned),
        // so we can directly create the synchronous result to return.
        result = SynchronousFuture<ResizeImageKey>(ResizeImageKey._(key, policy, width, height, allowUpscaling));
      } else {
        // This future did not synchronously complete.
        completer.complete(ResizeImageKey._(key, policy, width, height, allowUpscaling));
      }
    });
    if (result != null) {
      return result!;
    }
    // If the code reaches here, it means the imageProvider.obtainKey was not
    // completed sync, so we initialize the completer for completion later.
    completer = Completer<ResizeImageKey>();
    return completer.future;
  }
}
```

`ResizeImageKey`は単なるデータクラスなので、特に気にする必要はありません。^[コードを見る限り、record typeでも良さそうです。コンストラクタをprivateにするためにclassになっているのかな？]実は`class ResizeImage extends ImageProvider<ResizeImageKey>`と定義されているので、外部に公開されている必要があるクラスもでもあったりします。

#### loadImage

次に、`loadImage`を見ていきましょう。
ここまでの実装を見てきた方であれば、`loadImage`の実装は簡単に読めると思います。

https://github.com/flutter/flutter/blob/78666c8dc5/packages/flutter/lib/src/painting/image_provider.dart#L1274-L1342

`final ImageStreamCompleter completer = imageProvider.loadImage(key._providerCacheKey, decodeResize);`が最も重要な箇所です。
少しだけ確認します。

`key._providerCacheKey`は、`obtainKey`で生成した`ResizeImageKey`が渡されます。
先ほど確認した通り、`ResizeImageKey`は`ImageProvider`の`key`とリサイズの設定を合成したものです。このため、元データの`key`とは一致しません。このため`ImageCache`上で、`key`が衝突することはありません。

`decodeResize`については、これまでに確認してきた`ImageProvider`の実装クラスで`decode(await ui.ImmutableBuffer.fromUint8List(bytes))`を呼び出している箇所に、差し込まれる形でリサイズの指定がなされます。
処理が長いので引用は避けますが、`Image`クラスのコンストラクタを利用している場合、`policy = ResizeImagePolicy.exact`かつ`allowUpscaling = false`となります。これは、Resizeの目的が**メモリの使用量を抑える**ことにあることを考えると、妥当な設定です。

#### ResizedImageの使いどころ

`ResizeImage`は、`Image.new`のコンストラクタで指定することで、任意の設定を与えることができます。
もしも画像のリサイズを細かく制御したい場合には、設定してみてください。

## おわりに

Flutterの`Image`と`ImageProvider`の実装を追ってみました。

ここまで読まれた方は、[flutter_gen](https://pub.dev/packages/flutter_gen)で生成される`AssetGenImage`や、[cached_network_image](https://pub.dev/packages/cached_network_image)の[CachedNetworkImageProvider](https://pub.dev/documentation/cached_network_image/latest/cached_network_image/CachedNetworkImageProvider-class.html)の実装も読めるハズです。

と言うのもコードリーディングをしたのは、画像読み込みライブラリを作ってみよう、と思ったのがきっかけでした。実際、この辺まで読んだら動くものは作れています。

https://pub.dev/packages/taro

コードはこちら。

https://github.com/koji-1009/taro

作り上げた後に見てみると、自分が「`placeholder`はパーセント表示しないだろう…」とカットした箇所を、`cached_network_image`ではプラットフォームを考慮してしっかりと作り込んでいたりします。
より正しく実装しようとすると、ああいった構成になるんだなぁ…と学ぶことができました。

以上。メモ書きでした。お付き合いいただきありがとうございます。
