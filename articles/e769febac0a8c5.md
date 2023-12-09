---
title: "Flutterでコード生成ライブラリを使う時のコード管理について"
emoji: "🏃"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: [
    "Flutter",
]
published: true
published_at: "2023-12-09 21:00"
---

# はじめに

Flutterでアプリを開発していると、[freezed](https://pub.dev/packages/freezed)や[riverpod_generator](https://pub.dev/packages/riverpod_generator)などのコード生成ライブラリを使うことが多くなります。

筆者はいくつかのプロジェクトに参加してきたのですが、チームごとに、これら自動生成されるファイルの管理が異なっていました。
そこで、これらのライブラリが生成するコード管理について、私見をまとめます。

## mainブランチのあるべき姿

前提として、mainブランチは「市場にリリースされているコード」がそのまま管理されているべきだと考えています。
`git clone`したら最新のリリースに対応するコードが手に入り、`git checkout`でタグがついたcommitに移動すれば、そのリリース時のコードが手に入るようになっているべきだと思います。Flutterにおいては、`pubspec.lock`ファイルが利用ライブラリのバージョンを固定しているため、比較的簡単にこのような状態を実現できます。(ビルドしているFlutterのバージョンについては、`flutter downgrade`コマンドの対応や、`fvm`などの導入で実現できます)

この観点からすると、`gitignore`に`.g.dart`や`.freezed.dart`を追加するのは避けるべき、だと言えます。
たしかに`build_runner`などのバージョンも記載されているので、都度`dart pub run build_runner build`を実行すれば、同じコードが生成できるはずです。しかし、この手間を「特定のgit tagのバージョンを確認しなければならない」時に必須とするのは、大きな負担です。

## 生成コードの管理

生成される`.g.dart`や`.freezed.dart`の管理方法について。

私見としては、これらのファイルの生成については、広く使われている設定に従う方が**新規に参加するメンバーがびっくりしない**という点で優れていると思います。要は、デフォルトの設定を使っておけば、新規参加メンバーが「なぜこうなっているのか」という疑問を持つ必要がなく、また周囲もそれを説明する必要がないということです。

### IDEのサポートを活用する

現在では、Flutterのソースコードをファイラーで検索することは稀だと思います。大抵の場合、プロジェクトをIDEに読み込ませて、プロジェクトの内容を確認することが大半ではないかと。
そこで、個人的におすすめしたいのはIDEのサポートを活用することです。

#### VSCode

VSCodeには、[Explorer File Nesting](https://code.visualstudio.com/updates/v1_67#_explorer-file-nesting)機能が存在します。この機能は、一定の拡張子を持つファイルを、IDE上で階層表示する機能です。

https://github.com/FlutterKaigi/conference-app-2023/blob/main/.vscode/settings.json#L16-L18

fileのパターンとして、`.mock.dart`などを追加することで、まとめるファイルの種類を追加することもできます。上記のように`.vscode/settings.json`に設定を追加することで、プロジェクトに参加する全ての人に対して、同じ設定を適用することができます。

#### Android Studio/IntelliJ IDEA

Android Studio/IntelliJ IDEAには[File nesting rules](https://www.jetbrains.com/help/idea/file-nesting-dialog.html)機能が存在します。この機能は、一定の拡張子を持つファイルを、IDE上で階層表示する機能です。

こちらはAndroid StudioやIntelliJ IDEA上で設定を行う必要があります。自分の手元の環境を見たところ、この設定はプロジェクトごとではなく、IDEの設定として保存されているようです。
プロジェクトに参加するメンバー全員に適用するには、環境構築の手順書などに追加する必要がありそうです。VSCodeよりは、手間がかかりそうです。

### gitattributesを活用する

「Pull Requestのレビュー時に、レビュー内容と関係のない自動生成ファイルの差分が混じって困る」という声もあるかと思います。自動生成ファイルの差分が**本当にコードの編集内容と関係ない**かどうかについては、議論があるのですが、確かに[riverpod_generater](https://pub.dev/packages/riverpod_generator)などは、コードの編集内容と関係ない差分が発生することがあります。

https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github

GitHubには、`.gitattributes`に設定したファイルが差分に含まれている時に、デフォルトで閉じた状態にする機能が存在します。これを利用することで、レビュー時に自動生成ファイルの差分が表示されなくなります。(もちろん、差分を開いて確認することは可能です)

一例ですが、[FlutterKaigi 2023公式アプリ](https://github.com/FlutterKaigi/conference-app-2023)では、次のようなattributesを設定しています。

https://github.com/FlutterKaigi/conference-app-2023/blob/main/.gitattributes

# まとめ

`build.yaml`に設定を追加せず、快適に開発することもできるぞ……！ という気持ちが伝われば幸いです。
結局のところ、何をどれだけ重視するかなので、管理方法はチームごとに異なるかなと思います。記事が、議論のきっかけになれば幸いです。
