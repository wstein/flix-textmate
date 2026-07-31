    let rules = #{
        Path(x, y) :- Edge(x, y).
        Path(x, z) :- Path(x, y), Edge(y, z).
    };
    let merged = db1 <+> db2;
    query db select (x, y) from Path(x, y) where x < y
    let lam = #(x) -> x;
    def f(): Int32 \ IO = 1
    def g(): Int32 \ {} = 2
    let r = person#name;
    let s = node->value;
    type alias Row = #| A, B |#
