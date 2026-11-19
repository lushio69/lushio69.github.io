(texmacs-module (plugins blog-publish-mod))

(tm-define (blog-pad2 n)
  (if (< n 10) (string-append "0" (number->string n)) (number->string n))
) ;tm-define

(tm-define (blog-trim s)
  (catch #t (lambda () (string-trim-spaces s)) (lambda args (if (string? s) s "")))
) ;tm-define

(tm-define (blog-string-empty? s)
  (or (not (string? s)) (string=? (blog-trim s) ""))
) ;tm-define

(tm-define (blog-escape-string s)
  (let loop
    ((i 0) (out ""))
    (if (>= i (string-length s))
      out
      (let ((c (string-ref s i)))
        (cond ((char=? c #\\) (loop (+ i 1) (string-append out "\\\\")))
              ((char=? c #\") (loop (+ i 1) (string-append out "\\\"")))
              ((char=? c #\newline) (loop (+ i 1) (string-append out "\\n")))
              ((char=? c #\tab) (loop (+ i 1) (string-append out "\\t")))
              (else (loop (+ i 1) (string-append out (string c))))
        ) ;cond
      ) ;let
    ) ;let
  ) ;let
) ;tm-define

(tm-define (blog-quote-string s)
  (string-append "\"" (blog-escape-string (if (string? s) s "")) "\"")
) ;tm-define

(tm-define (blog-join-strings xs)
  (cond ((null? xs) "")
        ((null? (cdr xs)) (car xs))
        (else (string-append (car xs) " " (blog-join-strings (cdr xs))))
  ) ;cond
) ;tm-define

;; s7 cannot evaluate (quote x) / ("a" "b") forms here: use 'symbol and (list ...)
(tm-define (blog-quote-stree st)
  (cond ((string? st) (blog-quote-string st))
        ((symbol? st) (string-append "'" (symbol->string st)))
        ((number? st) (number->string st))
        ((boolean? st) (if st "#t" "#f"))
        ((pair? st) (string-append "(list " (blog-join-strings (map blog-quote-stree st)) ")"))
        (else "\"\"")
  ) ;cond
) ;tm-define

(tm-define (blog-quote-list xs)
  (cond ((null? xs) "'()")
        (else (string-append "(list " (blog-join-strings (map blog-quote-string xs)) ")"))
  ) ;cond
) ;tm-define

(tm-define (blog-split-commas xs)
  (cond ((null? xs) '())
        ((string=? (car xs) "") (blog-split-commas (cdr xs)))
        (else (cons (car xs) (blog-split-commas (cdr xs))))
  ) ;cond
) ;tm-define

(tm-define (blog-tags-as-list tags)
  (cond ((not tags) '())
        ((list? tags) tags)
        ((string? tags) (blog-split-commas (map blog-trim (string-split tags ","))))
        (else '())
  ) ;cond
) ;tm-define

(tm-define (blog-civil-day z)
  (let* ((z (+ z 719468))
         (era (quotient z 146097))
         (doe (- z (* era 146097)))
         (yoe (quotient (+ doe (- (quotient doe 1460)) (quotient doe 36524) (- (quotient doe 146096))) 365))
         (y (+ yoe (* era 400)))
         (doy (- doe (+ (* 365 yoe) (quotient yoe 4) (- (quotient yoe 100)))))
         (mp (quotient (+ (* 5 doy) 2) 153))
         (d (+ (- doy (quotient (+ (* 153 mp) 2) 5)) 1))
         (m (if (< mp 10) (+ mp 3) (- mp 9)))
         (y2 (if (<= m 2) (+ y 1) y))
        ) ;
    (list y2 m d)
  ) ;let*
) ;tm-define

(tm-define (blog-format-seconds secs)
  (let* ((days (quotient secs 86400))
         (day (blog-civil-day days))
        ) ;
    (string-append (number->string (car day))
      "-"
      (blog-pad2 (cadr day))
      "-"
      (blog-pad2 (car (cddr day)))
    ) ;string-append
  ) ;let*
) ;tm-define

(tm-define (blog-today-string)
  (blog-format-seconds (current-time))
) ;tm-define

(tm-define (blog-plugin-root)
  (let* ((user (string-append (getenv "TEXMACS_HOME_PATH") "/plugins/blog-publish"))
         (sys (string-append (getenv "TEXMACS_PATH") "/plugins/blog-publish"))
        ) ;
    (if (url-exists? user) user sys)
  ) ;let*
) ;tm-define

(tm-define (blog-goldfish-root)
  (string-append (blog-plugin-root) "/goldfish")
) ;tm-define

(tm-define blog-result-serial 0)

(tm-define (blog-result-path)
  (set! blog-result-serial (+ blog-result-serial 1))
  (string-append (getenv "TEXMACS_HOME_PATH")
    "/system/tmp/blog-result-"
    (number->string (current-time))
    "-"
    (number->string blog-result-serial)
    ".txt"
  ) ;string-append
) ;tm-define

(tm-define (blog-script-for title category tags file dir stree out)
  (let* ((t (if (blog-string-empty? title) "untitled" (blog-trim title)))
         (c (blog-trim category))
         (tg (blog-tags-as-list tags))
        ) ;
    (string-append
      "(let* ((root " (blog-quote-string (blog-goldfish-root)) "))\n"
      "  (set! *load-path* (cons root *load-path*))\n"
      "  (import (liii blog-publish))\n"
      "  (blog-set-dates! " (blog-quote-string (blog-today-string)) ")\n"
      "  (call-with-output-file " (blog-quote-string out) "\n"
      "    (lambda (port)\n"
      "      (display (blog-export-doc! (blog-make " (blog-quote-string t) " "
         (blog-quote-string c) " "
         (blog-quote-list tg) " "
         (blog-quote-string file) " "
         (blog-quote-string dir) " "
         (blog-quote-stree stree)
         ")) port)\n"
      "    ) ;lambda\n"
      "  ) ;call-with-output-file\n"
      ")\n"
    ) ;string-append
  ) ;let*
) ;tm-define

(tm-define (blog-scan-lines lines tag)
  (cond ((null? lines) "")
        ((and (>= (string-length (car lines)) (string-length tag))
              (string=? (substring (car lines) 0 (string-length tag)) tag)
         ) ;and
         (blog-trim (substring (car lines) (string-length tag) (string-length (car lines))))
        ) ;
        (else (blog-scan-lines (cdr lines) tag))
  ) ;cond
) ;tm-define

(tm-define (blog-line-value text tag)
  (blog-scan-lines (string-split (if (string? text) text "") "\n") tag)
) ;tm-define

(tm-define (blog-report-result text)
  (let* ((file (blog-line-value text "FILE|"))
         (ok (blog-line-value text "OK|"))
         (err (blog-line-value text "ERR|"))
        ) ;
    (cond ((not (blog-string-empty? ok)) (set-message ok "blog"))
          ((not (blog-string-empty? err)) (set-message err "blog"))
          ((not (blog-string-empty? file)) (set-message (string-append "exported: " file) "blog"))
          ((not (blog-string-empty? text)) (set-message (blog-trim text) "blog"))
          (else (set-message "finished" "blog"))
    ) ;cond
  ) ;let*
) ;tm-define

(tm-define (blog-run-script raw out)
  (let* ((path (string-append out ".scm"))
         (cmd (string-append "(load \"" (blog-escape-string path) "\")"))
        ) ;
    (string-save raw path)
    (catch #t
      (lambda ()
        (silent-feed* "goldfish"
          "blog-publish"
          `(document ,cmd)
          (lambda (result)
            (blog-report-result
              (cond ((url-exists? out) (string-load out))
                    ((string? result) result)
                    (else "")
              ) ;cond
            ) ;blog-report-result
          ) ;lambda
          '()
        ) ;silent-feed*
        ""
      ) ;lambda
      (lambda errs (set-message "goldfish connection failed" "blog") "")
    ) ;catch
  ) ;let*
) ;tm-define

(tm-define (blog-current-file)
  (catch #t (lambda () (with doc (buffer-get (current-buffer)) (get-env "file"))) (lambda args ""))
) ;tm-define

(tm-define (blog-current-dir)
  (catch #t (lambda () (with doc (buffer-get (current-buffer)) (get-env "pwd"))) (lambda args ""))
) ;tm-define

(tm-define (blog-first-of-children xs)
  (cond ((null? xs) "")
        ((and (pair? (car xs)) (memq (car (car xs)) '(doc-title chapter chapter* section section*)))
         (let ((t (blog-first-text-node (car xs))))
           (if (blog-string-empty? t) (blog-first-of-children (cdr xs)) t)
         ) ;let
        ) ;
        (else (blog-first-of-children (cdr xs)))
  ) ;cond
) ;tm-define

(tm-define (blog-first-text-node st)
  (cond ((string? st) (blog-trim st))
        ((not (pair? st)) "")
        ((and (eq? (car st) 'chapter*) (pair? (cdr st)) (string? (cadr st))) (blog-trim (cadr st)))
        (else (blog-first-of-children (cdr st)))
  ) ;cond
) ;tm-define

(tm-define (blog-default-title)
  (catch #t
    (lambda ()
      (let* ((st (tree->stree (buffer-get (current-buffer))))
             (text (blog-first-text-node st))
            ) ;
        (if (blog-string-empty? text) "untitled" text)
      ) ;let*
    ) ;lambda
    (lambda args "untitled")
  ) ;catch
) ;tm-define

(tm-define (blog-publish-current-buffer . opts)
  (:synopsis "Publish current document to the blog")
  (let* ((title (if (pair? opts) (car opts) ""))
         (category (if (and (pair? opts) (pair? (cdr opts))) (cadr opts) ""))
         (tags (if (and (pair? opts) (pair? (cdr opts)) (pair? (cddr opts))) (caddr opts) '()))
         (file (blog-current-file))
         (dir (blog-current-dir))
         (stree (tree->stree (buffer-get (current-buffer))))
         (out (blog-result-path))
        ) ;
    (blog-run-script (blog-script-for title category tags file dir stree out) out)
  ) ;let*
) ;tm-define

(tm-define (blog-export-current-buffer . opts)
  (:synopsis "Export current document to the blog without publishing")
  (blog-publish-current-buffer)
) ;tm-define
